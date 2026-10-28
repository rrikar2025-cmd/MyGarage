import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  useGarage,
  localDate,
  validateJournal,
  type FuelEntry,
  type ServiceEntry,
} from '@/entities/garage';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { useUnsavedChanges } from '@/shared/navigation';
import { Button, Card, Field, Notice, Screen } from '@/shared/ui';
import { createDraft, buildEntry } from '../model/draft';
import { FuelFields, type UpdateDraft } from './FuelFields';
import { ServiceFields } from './ServiceFields';
export function EntryForm({
  kind,
  vehicleId,
  mileage,
  existing,
}: {
  kind: 'fuel' | 'service';
  vehicleId: string;
  mileage: number;
  existing?: FuelEntry | ServiceEntry;
}) {
  const { t } = useTranslation();
  const [id] = useState(() => existing?.id ?? randomUUID());
  const [createdAt] = useState(() => existing?.created_at ?? new Date().toISOString());
  const first = useRef<TextInput>(null);
  const nextRef = useRef<TextInput>(null);
  const nextDateRef = useRef<TextInput>(null);
  const [form, setForm] = useState(() => createDraft(mileage, existing));
  const [baseline] = useState(() => JSON.stringify(form));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const guard = useUnsavedChanges(!saved && JSON.stringify(form) !== baseline, busy);
  useEffect(() => {
    if (saved) router.replace('/journal');
  }, [saved]);
  const update: UpdateDraft = (key, value) => setForm((s) => ({ ...s, [key]: value }));
  async function save() {
    if (busy) return;
    const entry = buildEntry(kind, form, id, vehicleId, createdAt);
    const issue = validateJournal(entry);
    if (issue) {
      setError(issue);
      (issue === 'nextDateInvalid'
        ? nextDateRef
        : issue === 'nextInvalid'
          ? nextRef
          : first
      ).current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if ('liters' in entry) await useGarage.getState().saveFuel(entry);
      else await useGarage.getState().saveService(entry);
      setSaved(true);
    } catch {
      setError('saveFailed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title={t(existing ? 'editEntry' : kind === 'fuel' ? 'addFuel' : 'addService')}
      action={
        <Button label={t('back')} variant="ghost" disabled={busy} onPress={() => router.back()} />
      }
    >
      <Card>
        <Field
          ref={first}
          label={t('date')}
          placeholder={localDate()}
          maxLength={10}
          value={form.date}
          onChangeText={(v) => update('date', v)}
          editable={!busy}
        />
        <Field
          label={t('odometer')}
          keyboardType="number-pad"
          maxLength={8}
          value={form.odometer}
          onChangeText={(v) => update('odometer', v)}
          editable={!busy}
        />
        <Field
          label={t('amount')}
          keyboardType="decimal-pad"
          maxLength={12}
          value={form.total}
          onChangeText={(v) => update('total', v)}
          editable={!busy}
        />
        {kind === 'fuel' ? (
          <FuelFields form={form} update={update} busy={busy} />
        ) : (
          <ServiceFields
            form={form}
            update={update}
            busy={busy}
            nextRef={nextRef}
            nextDateRef={nextDateRef}
            issue={error === 'nextInvalid' || error === 'nextDateInvalid' ? error : null}
          />
        )}
        {error && <Notice tone="error">{t(error)}</Notice>}
        <Button label={t('saveEntry')} busy={busy} onPress={() => void save()} />
      </Card>
      {guard}
    </Screen>
  );
}
