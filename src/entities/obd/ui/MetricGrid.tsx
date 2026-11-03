import { View, useWindowDimensions } from 'react-native';
import type { MetricKey, Metrics, TelemetryUnits } from '@/shared/types';
import { useTranslation } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib';
import { Card, Text } from '@/shared/ui';
import { metricCatalog, displayMetric } from '../lib/metrics';
export function MetricGrid({
  keys,
  metrics,
  units,
  compact = false,
}: {
  keys: MetricKey[];
  metrics: Metrics;
  units: TelemetryUnits;
  compact?: boolean;
}) {
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {keys.map((key) => {
        const metric = displayMetric(key, metrics[key], units);
        const value =
          metric.value === undefined
            ? '—'
            : formatNumber(metric.value, locale, metricCatalog[key].digits);
        return (
          <Card
            key={key}
            style={{
              flexBasis: width < 360 ? '100%' : '46%',
              flexGrow: 1,
              gap: compact ? 2 : 6,
              ...(compact ? { padding: 12 } : {}),
            }}
          >
            <Text muted variant="caption">
              {t(metricCatalog[key].label)}
            </Text>
            <View
              style={
                compact
                  ? { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 }
                  : undefined
              }
            >
              <Text
                variant="data"
                style={compact || value.length > 7 ? { fontSize: 22, lineHeight: 30 } : undefined}
              >
                {value}
              </Text>
              <Text muted variant="caption">
                {key === 'rpm'
                  ? t('rpmUnit')
                  : metric.unit === 'km/h'
                    ? t('speedUnit')
                    : metric.unit}
              </Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}
