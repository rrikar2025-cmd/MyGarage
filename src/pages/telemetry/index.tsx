import { router } from 'expo-router';
import { ConnectionPanel } from '@/features/connect-adapter';
import { LiveTelemetry } from '@/widgets/live-telemetry';
import { useTranslation } from '@/shared/i18n';
import { Button, Screen } from '@/shared/ui';
export function TelemetryPage() {
  const { t } = useTranslation();
  return (
    <Screen
      title={t('telemetryDashboard')}
      action={<Button label={t('back')} variant="ghost" onPress={() => router.back()} />}
    >
      <ConnectionPanel />
      <Button
        label={t('configureMetrics')}
        variant="secondary"
        onPress={() => router.push('/telemetry-settings')}
      />
      <LiveTelemetry charts />
    </Screen>
  );
}
