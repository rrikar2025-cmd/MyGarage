import { useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/entities/session';
import { disconnectAdapter } from '@/entities/obd';
import { ServiceReminderSetting, disablePushDevice } from '@/features/push-notifications';
import { supabase } from '@/shared/api';
import { isCloudConfigured } from '@/shared/config';
import { usePreferences } from '@/shared/model';
import { useTranslation } from '@/shared/i18n';
import { Button, Card, Choice, Confirm, Notice, Screen, Section, Text } from '@/shared/ui';
export function SettingsPage() {
  const { t } = useTranslation();
  const locale = usePreferences((s) => s.locale);
  const theme = usePreferences((s) => s.theme);
  const session = useSession((s) => s.session);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    setBusy(true);
    setError(false);
    try {
      if (session?.user.id) await disablePushDevice(session.user.id).catch(() => {});
      const result = await supabase?.auth.signOut({ scope: 'local' });
      if (result?.error) throw result.error;
      await disconnectAdapter();
      setConfirm(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title={t('settings')}>
      <Section title={t('language')}>
        <Card>
          <Choice
            label={t('language')}
            value={locale}
            options={[
              { value: 'uk', label: 'Українська' },
              { value: 'en', label: 'English' },
            ]}
            onChange={usePreferences.getState().setLocale}
          />
        </Card>
      </Section>
      <Section title={t('appearance')}>
        <Card>
          <Choice
            label={t('appearance')}
            value={theme}
            options={[
              { value: 'system', label: t('system') },
              { value: 'light', label: t('light') },
              { value: 'dark', label: t('dark') },
            ]}
            onChange={usePreferences.getState().setTheme}
          />
        </Card>
      </Section>
      {
        <Section title={t('servicePushTitle')}>
          <Card>
            <ServiceReminderSetting ownerId={session?.user.id ?? null} />
          </Card>
        </Section>
      }
      <Card>
        <Text variant="heading">{t('telemetryDashboard')}</Text>
        <Button
          label={t('configureMetrics')}
          variant="secondary"
          onPress={() => router.push('/telemetry-settings')}
        />
      </Card>
      <Section title={t('cloud')}>
        <Card>
          <Text style={{ fontWeight: '700' }}>{t(session ? 'cloudMode' : 'localMode')}</Text>
          {session && <Text muted>{session.user.email}</Text>}
          <Text muted>{t(session ? 'cloudModeHint' : 'localModeHint')}</Text>
          {!isCloudConfigured && <Notice>{t('cloudUnavailable')}</Notice>}
          {session ? (
            <Button label={t('signOut')} variant="danger" onPress={() => setConfirm(true)} />
          ) : (
            <Button
              label={t('signIn')}
              disabled={!isCloudConfigured}
              onPress={() => router.push('/auth')}
            />
          )}
          {error && <Notice tone="error">{t('authFailed')}</Notice>}
        </Card>
      </Section>
      {session && (
        <Card>
          <Text variant="heading">{t('accountSecurity')}</Text>
          <Button
            label={t('forgotPassword')}
            variant="secondary"
            onPress={() => router.push('/auth/reset')}
          />
          <Button
            label={t('deleteAccount')}
            variant="ghost"
            onPress={() => router.push('/account-delete')}
          />
        </Card>
      )}
      <Card>
        <Text variant="heading">{t('about')}</Text>
        <Text muted>{t('aboutBody')}</Text>
        <Text muted variant="caption">
          {t('version')}
        </Text>
      </Card>
      <Confirm
        visible={confirm}
        title={t('signOut')}
        body={t('signOutBody')}
        action={t('signOut')}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void signOut()}
      />
    </Screen>
  );
}
