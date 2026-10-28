import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';
import type { MetricKey, TelemetryUnits } from '@/shared/types';
import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { formatNumber } from '@/shared/lib';
import { Card, Text } from '@/shared/ui';
import { buildSparkline, displayMetric, metricCatalog, type TelemetrySample } from '../lib/metrics';
export function MetricTrend({
  metricKey,
  samples,
  units,
}: {
  metricKey: MetricKey;
  samples: TelemetrySample[];
  units: TelemetryUnits;
}) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const values = samples.map((s) => displayMetric(metricKey, s.metrics[metricKey], units).value);
  const actual = values.filter((value): value is number => value !== undefined);
  if (actual.length < 2) return null;
  return (
    <Card>
      <Text style={{ fontWeight: '700' }}>{t(metricCatalog[metricKey].label)}</Text>
      <Svg viewBox="0 0 280 60" height={60} width="100%" accessible={false}>
        <Path d={buildSparkline(values)} stroke={colors.primary} strokeWidth={2} fill="none" />
      </Svg>
      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        <Text muted variant="caption">
          {t('minimum')}:{' '}
          {formatNumber(Math.min(...actual), locale, metricCatalog[metricKey].digits)}
        </Text>
        <Text muted variant="caption">
          {t('maximum')}:{' '}
          {formatNumber(Math.max(...actual), locale, metricCatalog[metricKey].digits)}
        </Text>
        <Text muted variant="caption">
          {displayMetric(metricKey, 0, units).unit}
        </Text>
      </View>
    </Card>
  );
}
