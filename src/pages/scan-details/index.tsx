import { router, useLocalSearchParams } from 'expo-router';
import { useGarage } from '@/entities/garage';
import { CodeGroup, MetricGrid } from '@/entities/obd';
import { usePreferences } from '@/shared/model';
import { metricKeys, type Metrics } from '@/shared/types';
import { useTranslation } from '@/shared/i18n';
import { formatDate } from '@/shared/lib';
import { Button, Card, EmptyState, Loading, Notice, Screen, Section, Text } from '@/shared/ui';
export function ScanDetailsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const scan = useGarage((s) => s.scans.find((entry) => entry.id === id));
  const vehicle = useGarage((s) => s.vehicles.find((entry) => entry.id === scan?.vehicle_id));
  const loading = useGarage((s) => s.loading);
  const units = usePreferences((s) => s.units);
  const keys = metricKeys.filter((key) => Number.isFinite(scan?.metrics[key]));
  return (
    <Screen
      title={t('scanDetails')}
      action={<Button label={t('back')} variant="ghost" onPress={() => router.back()} />}
    >
      {loading ? (
        <Loading />
      ) : !scan ? (
        <EmptyState title={t('scanNotFound')} description={t('scanNotFoundHint')}>
          <Button label={t('diagnostics')} onPress={() => router.replace('/diagnostics')} />
        </EmptyState>
      ) : (
        <>
          <Card>
            <Text variant="heading">
              {vehicle ? `${vehicle.make} ${vehicle.model}` : t('vehicle')}
            </Text>
            <Text muted>{formatDate(scan.created_at, locale)}</Text>
            <Text>
              {t(
                scan.context?.mode === 'confirmed'
                  ? 'scanConfirmedMode'
                  : scan.context?.mode === 'all'
                    ? 'scanAllMode'
                    : 'scanLegacyMode',
              )}
            </Text>
            {scan.context?.device_name && <Text muted>{scan.context.device_name}</Text>}
            <Text selectable>VIN: {scan.context?.vin ?? '—'}</Text>
            {scan.context?.duration_ms !== undefined && (
              <Text muted>
                {t('scanDuration')}: {Math.round(scan.context.duration_ms / 1000)} {t('seconds')}
              </Text>
            )}
          </Card>
          <Notice>{t('savedSnapshotHint')}</Notice>
          {(['stored', 'pending', 'permanent'] as const).map((kind) => (
            <Card key={kind}>
              <CodeGroup kind={kind} codes={scan[kind]} status={scan.context?.statuses?.[kind]} />
            </Card>
          ))}
          <Section title={t('scanReadings')}>
            <Notice>{t('snapshotNotFreezeFrame')}</Notice>
            {scan.context?.telemetry_at && (
              <Text muted variant="caption">
                {formatDate(scan.context.telemetry_at, locale)}
              </Text>
            )}
            {keys.length ? (
              <MetricGrid keys={keys} metrics={scan.metrics as Metrics} units={units} />
            ) : (
              <Notice>{t('noSnapshotReadings')}</Notice>
            )}
          </Section>
        </>
      )}
    </Screen>
  );
}
