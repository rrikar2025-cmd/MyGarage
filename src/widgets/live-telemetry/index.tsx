import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useOBD, MetricGrid, MetricTrend } from '@/entities/obd';
import { usePreferences } from '@/shared/model';
import { useTranslation } from '@/shared/i18n';
import { Button, Notice, Section, Text } from '@/shared/ui';
import { formatDate } from '@/shared/lib';
export function LiveTelemetry({ charts = false }: { charts?: boolean }) {
  const { t, locale } = useTranslation();
  const metrics = useOBD((s) => s.metrics);
  const samples = useOBD((s) => s.samples);
  const status = useOBD((s) => s.status);
  const updatedAt = useOBD((s) => s.updatedAt);
  const reading = useOBD((s) => s.reading);
  const keys = usePreferences((s) => s.dashboardMetrics);
  const units = usePreferences((s) => s.units);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const stale = !updatedAt || now - Date.parse(updatedAt) > 15000;
  return (
    <Section title={t('liveData')}>
      <Notice>
        {t(
          status !== 'connected'
            ? 'liveHint'
            : reading
              ? 'telemetryPaused'
              : stale
                ? 'telemetryStale'
                : 'telemetryLive',
        )}
      </Notice>
      {updatedAt && (
        <Text muted variant="caption">
          {t('lastReading')}: {formatDate(updatedAt, locale)}
        </Text>
      )}
      <MetricGrid keys={keys} metrics={status === 'connected' ? metrics : {}} units={units} />
      {charts && (
        <>
          <Text muted variant="caption">
            {t('trendHint')}
          </Text>
          {status === 'connected' &&
            keys.map((key) => (
              <MetricTrend key={key} metricKey={key} units={units} samples={samples} />
            ))}
        </>
      )}
      {!charts && (
        <Button
          label={t('telemetryDashboard')}
          variant="secondary"
          onPress={() => router.push('/telemetry')}
        />
      )}
      {!charts && status !== 'connected' && (
        <Button
          label={t('connectAdapter')}
          icon="bluetooth"
          onPress={() => router.navigate('/diagnostics')}
        />
      )}
    </Section>
  );
}
