import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Platform, AppState } from 'react-native';
import { usePreferences } from '@/shared/model';
import { useTranslation } from '@/shared/i18n';
import { Button, Notice, Text, Toggle } from '@/shared/ui';
import {
  enablePushDevice,
  isPushDeviceEnabled,
  PushPermissionDeniedError,
  disablePushDevice,
} from '../api/device';

export function ServiceReminderSetting({ ownerId }: { ownerId: string | null }) {
  const { t } = useTranslation();
  const locale = usePreferences((s) => s.locale);
  const lock = useRef(false),
    generation = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(Boolean(ownerId));
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<
    'servicePushPermissionDenied' | 'servicePushFailed' | null
  >(null);

  useEffect(() => {
    const gen = ++generation.current;
    setErrorKey(null);
    if (!ownerId || Platform.OS === 'web') {
      setEnabled(false);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void isPushDeviceEnabled(ownerId)
      .then((value) => {
        if (active && gen === generation.current) setEnabled(value);
      })
      .catch(() => {
        if (active) setErrorKey('servicePushFailed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [ownerId, locale, refreshKey]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRefreshKey((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  async function updateEnabled(next: boolean) {
    if (!ownerId || lock.current || loading) return;
    const gen = generation.current;
    lock.current = true;
    setBusy(true);
    setErrorKey(null);
    try {
      if (next) await enablePushDevice(ownerId);
      else await disablePushDevice(ownerId);
      if (gen === generation.current) setEnabled(next);
    } catch (error) {
      if (gen === generation.current)
        setErrorKey(
          error instanceof PushPermissionDeniedError
            ? 'servicePushPermissionDenied'
            : 'servicePushFailed',
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (Platform.OS === 'web') return <Notice>{t('servicePushNativeOnly')}</Notice>;
  if (!ownerId) {
    return (
      <>
        <Text muted>{t('servicePushSignIn')}</Text>
        <Button label={t('signIn')} onPress={() => router.push('/auth')} />
      </>
    );
  }

  return (
    <>
      <Toggle
        label={t('servicePushTitle')}
        hint={enabled ? t('servicePushOn') : t('servicePushOff')}
        value={enabled}
        onChange={(value) => void updateEnabled(value)}
        disabled={loading || busy}
      />
      <Text muted variant="caption">
        {t('servicePushHint')}
      </Text>
      {errorKey && (
        <>
          <Notice tone="error">{t(errorKey)}</Notice>
          <Button label={t('retry')} disabled={busy} onPress={() => setRefreshKey((n) => n + 1)} />
        </>
      )}
    </>
  );
}
