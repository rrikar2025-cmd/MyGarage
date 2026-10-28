import { router } from 'expo-router';
import { TelemetrySettings } from '@/features/telemetry-settings';
import { useTranslation } from '@/shared/i18n';
import { Button, Screen } from '@/shared/ui';
export function TelemetrySettingsPage() {
  const { t } = useTranslation();
  return (
    <Screen
      title={t('dashboardMetrics')}
      action={<Button label={t('back')} variant="ghost" onPress={() => router.back()} />}
    >
      <TelemetrySettings />
    </Screen>
  );
}
