import { router } from 'expo-router';
import { ClearCodes } from '@/features/clear-codes';
import { ConnectionPanel } from '@/features/connect-adapter';
import { ScanVehicle } from '@/features/scan-vehicle';
import { useGarage, useSelectedVehicle } from '@/entities/garage';
import { useTranslation } from '@/shared/i18n';
import { formatDate } from '@/shared/lib';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  Screen,
  Section,
  Text,
  Loading,
  ErrorState,
} from '@/shared/ui';
export function DiagnosticsPage() {
  const { t, locale } = useTranslation();
  const vehicle = useSelectedVehicle();
  const scans = useGarage((s) => s.scans);
  const loading = useGarage((s) => s.loading);
  const error = useGarage((s) => s.error);
  const owner = useGarage((s) => s.owner);
  const history = scans.filter((s) => s.vehicle_id === vehicle?.id).slice(0, 20);
  return (
    <Screen
      title={t('diagnostics')}
      subtitle={vehicle ? `${vehicle.make} ${vehicle.model}` : t('scanScope')}
    >
      <ConnectionPanel />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState onRetry={() => void useGarage.getState().load(owner)} />
      ) : (
        <>
          <ScanVehicle />
          <Button
            label={t('telemetryDashboard')}
            variant="secondary"
            onPress={() => router.push('/telemetry')}
          />
          <ClearCodes />
          <Section title={t('history')}>
            {!history.length ? (
              <EmptyState title={t('noScans')} description={t('noScansBody')} icon="activity" />
            ) : (
              history.map((scan) => (
                <Card key={scan.id}>
                  <Button
                    label={t('scanDetails')}
                    variant="secondary"
                    onPress={() => router.push(`/scan/${scan.id}`)}
                  />
                  <Text style={{ fontWeight: '700' }}>{t(scan.context?.mode === 'confirmed' ? 'scanConfirmedMode' : scan.context?.mode === 'all' ? 'scanAllMode' : 'scanLegacyMode')}</Text>
                  <Text variant="caption" muted>
                    {formatDate(scan.created_at, locale)}
                  </Text>
                  {(['stored', 'pending', 'permanent'] as const).map((kind) => (
                    <Text key={kind} variant="caption">
                      {t(kind)}: {scan[kind].join(', ') || t(scan.context?.statuses?.[kind] === 'read' ? 'groupNoCodes' : scan.context?.statuses?.[kind] === 'unavailable' ? 'readUnavailable' : scan.context?.statuses?.[kind] === 'not_requested' ? 'readNotRequested' : 'readUnknown')}
                    </Text>
                  ))}
                </Card>
              ))
            )}
          </Section>
        </>
      )}
      <Notice>{t('privacyNote')}</Notice>
    </Screen>
  );
}
