import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { localDate, useGarage } from '@/entities/garage';
import {
  readInsurance,
  saveInsurance,
  removeInsurance,
  validInsuranceDate,
  type InsurancePolicy,
} from '@/entities/insurance';
import {
  insuranceReminderEnabled,
  scheduleInsuranceReminders,
  cancelInsuranceReminders,
} from '@/features/insurance-reminders';
import { useUnsavedChanges } from '@/shared/navigation';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { Button, Card, Confirm, Field, Loading, Notice, Screen, Text } from '@/shared/ui';

export function InsurancePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const state = useGarage();
  const vehicle = state.vehicles.find((item) => item.id === id);
  if (state.loading)
    return (
      <Screen title={t('insuranceTitle')}>
        <Loading />
      </Screen>
    );
  if (state.error || !vehicle)
    return (
      <Screen title={t('insuranceTitle')}>
        <Notice tone="error">{t('noVehicleFound')}</Notice>
        <Button label={t('back')} onPress={() => router.back()} />
      </Screen>
    );
  return (
    <InsuranceForm
      key={`${state.owner ?? 'guest'}:${vehicle.id}`}
      owner={state.owner}
      vehicleId={vehicle.id}
      name={`${vehicle.make} ${vehicle.model}`}
    />
  );
}

function InsuranceForm({
  owner,
  vehicleId,
  name,
}: {
  owner: string | null;
  vehicleId: string;
  name: string;
}) {
  const { t, locale } = useTranslation();
  const [form, setForm] = useState({ provider: '', policy_number: '', expires_on: '' });
  const [baseline, setBaseline] = useState('');
  const [policy, setPolicy] = useState<InsurancePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const lock = useRef(false);
  const guard = useUnsavedChanges(
    !loading && baseline !== '' && JSON.stringify(form) !== baseline,
    busy,
  );
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([readInsurance(owner, vehicleId), insuranceReminderEnabled(owner, vehicleId)])
      .then(([data, value]) => {
        if (!active) return;
        const next = {
          provider: data?.provider ?? '',
          policy_number: data?.policy_number ?? '',
          expires_on: data?.expires_on ?? '',
        };
        setForm(next);
        setBaseline(JSON.stringify(next));
        setPolicy(data);
        setEnabled(value);
      })
      .catch(() => {
        if (active) setError('insuranceLoadFailed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [owner, vehicleId, refresh]);
  async function save() {
    if (lock.current) return;
    if (!validInsuranceDate(form.expires_on)) {
      setError('insuranceDateInvalid');
      return;
    }
    const next = {
      vehicle_id: vehicleId,
      provider: form.provider.trim(),
      policy_number: form.policy_number.trim(),
      expires_on: form.expires_on,
    };
    lock.current = true;
    setBusy(true);
    setError(null);
    setSaved(false);
    let written = false;
    try {
      await saveInsurance(owner, next);
      written = true;
      setSaved(true);
      setPolicy(next);
      setForm({
        provider: next.provider,
        policy_number: next.policy_number,
        expires_on: next.expires_on,
      });
      setBaseline(
        JSON.stringify({
          provider: next.provider,
          policy_number: next.policy_number,
          expires_on: next.expires_on,
        }),
      );
      if (enabled) await scheduleInsuranceReminders(owner, next, locale, false);
    } catch {
      if (written) await cancelInsuranceReminders(owner, vehicleId).catch(() => {});
      setError(written ? 'insuranceReminderFailed' : 'saveFailed');
      if (written) setEnabled(false);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function toggleReminder() {
    if (!policy || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await cancelInsuranceReminders(owner, vehicleId);
        setEnabled(false);
      } else {
        await scheduleInsuranceReminders(owner, policy, locale, true);
        setEnabled(true);
      }
    } catch {
      setError('insuranceReminderFailed');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    let deleted = false;
    try {
      await removeInsurance(owner, vehicleId);
      deleted = true;
      const empty = { provider: '', policy_number: '', expires_on: '' };
      setForm(empty);
      setBaseline(JSON.stringify(empty));
      setPolicy(null);
      setEnabled(false);
      setSaved(false);
      setConfirm(false);
      await cancelInsuranceReminders(owner, vehicleId);
    } catch {
      setError(deleted ? 'insuranceCancelFailed' : 'saveFailed');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen
      title={t('insuranceTitle')}
      subtitle={name}
      action={
        <Button label={t('back')} variant="ghost" disabled={busy} onPress={() => router.back()} />
      }
    >
      {loading ? (
        <Loading />
      ) : (
        <Card>
          {error === 'insuranceLoadFailed' ? (
            <>
              <Notice tone="error">{t(error)}</Notice>
              <Button label={t('retry')} onPress={() => setRefresh((n) => n + 1)} />
            </>
          ) : (
            <>
              <Field
                label={t('insuranceProvider')}
                maxLength={100}
                value={form.provider}
                editable={!busy}
                onChangeText={(value) => setForm((s) => ({ ...s, provider: value }))}
              />
              <Field
                label={t('insuranceNumber')}
                maxLength={100}
                value={form.policy_number}
                editable={!busy}
                onChangeText={(value) => setForm((s) => ({ ...s, policy_number: value }))}
              />
              <Field
                label={t('insuranceExpires')}
                placeholder="YYYY-MM-DD"
                hint={t('insuranceDateHint')}
                maxLength={10}
                value={form.expires_on}
                editable={!busy}
                onChangeText={(value) => setForm((s) => ({ ...s, expires_on: value }))}
              />
              {error && <Notice tone="error">{t(error)}</Notice>}
              {saved && JSON.stringify(form) === baseline && (
                <Notice tone="success">{t('insuranceSaved')}</Notice>
              )}
              <Button label={t('insuranceSave')} busy={busy} onPress={() => void save()} />
              {policy && (
                <>
                  {policy.expires_on < localDate() && (
                    <Notice tone="error">{t('insuranceExpired')}</Notice>
                  )}
                  <Text muted variant="caption">
                    {t('insuranceReminderHint')}
                  </Text>
                  {JSON.stringify(form) !== baseline && (
                    <Text muted variant="caption">
                      {t('insuranceSaveFirst')}
                    </Text>
                  )}
                  {Platform.OS === 'web' ? (
                    <Notice>{t('insuranceNativeOnly')}</Notice>
                  ) : (
                    <Button
                      label={t(enabled ? 'insuranceDisableReminder' : 'insuranceEnableReminder')}
                      variant="secondary"
                      disabled={
                        busy ||
                        JSON.stringify(form) !== baseline ||
                        (!enabled && policy.expires_on < localDate())
                      }
                      onPress={() => void toggleReminder()}
                    />
                  )}
                  <Button
                    label={t('insuranceRemove')}
                    variant="danger"
                    disabled={busy}
                    onPress={() => setConfirm(true)}
                  />
                </>
              )}
            </>
          )}
        </Card>
      )}
      <Confirm
        visible={confirm}
        title={t('insuranceRemove')}
        body={t('insuranceRemoveBody')}
        action={t('insuranceRemove')}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void remove()}
      />
      {guard}
    </Screen>
  );
}
