import { View } from 'react-native';
import { usePreferences } from '@/shared/model';
import { metricKeys, type MetricKey } from '@/shared/types';
import { metricCatalog } from '@/entities/obd';
import { useTranslation } from '@/shared/i18n';
import { Button, Card, Choice, Section, Text, Toggle } from '@/shared/ui';
export function TelemetrySettings() {
  const { t } = useTranslation();
  const keys = usePreferences((s) => s.dashboardMetrics);
  const units = usePreferences((s) => s.units);
  function move(key: MetricKey, direction: number) {
    const index = keys.indexOf(key),
      target = index + direction;
    if (target < 0 || target >= keys.length) return;
    const next = [...keys];
    [next[index], next[target]] = [next[target]!, next[index]!];
    usePreferences.getState().setDashboardMetrics(next);
  }
  return (
    <>
      <Section title={t('telemetryUnits')}>
        <Card>
          <Choice
            label={t('telemetryUnits')}
            value={units}
            options={[
              { value: 'metric', label: t('metricUnits') },
              { value: 'imperial', label: t('imperialUnits') },
            ]}
            onChange={usePreferences.getState().setUnits}
          />
          <Text muted variant="caption">
            {t('telemetryUnitsHint')}
          </Text>
        </Card>
      </Section>
      <Section title={t('dashboardMetrics')}>
        <Text muted variant="caption">
          {t('dashboardMetricsHint')}
        </Text>
        <Card>
          {metricKeys.map((key) => (
            <Toggle
              key={key}
              label={t(metricCatalog[key].label)}
              value={keys.includes(key)}
              disabled={keys.includes(key) ? keys.length === 1 : keys.length >= 8}
              onChange={(selected) =>
                usePreferences
                  .getState()
                  .setDashboardMetrics(
                    selected ? [...keys, key] : keys.filter((item) => item !== key),
                  )
              }
            />
          ))}
        </Card>
      </Section>
      <Section title={t('metricOrder')}>
        {keys.map((key, index) => (
          <Card key={key}>
            <Text style={{ fontWeight: '700' }}>
              {index + 1}. {t(metricCatalog[key].label)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button
                label={t('up')}
                accessibilityLabel={`${t('moveUp')}: ${t(metricCatalog[key].label)}`}
                style={{ flexGrow: 1 }}
                variant="secondary"
                disabled={index === 0}
                onPress={() => move(key, -1)}
              />
              <Button
                label={t('down')}
                accessibilityLabel={`${t('moveDown')}: ${t(metricCatalog[key].label)}`}
                style={{ flexGrow: 1 }}
                variant="ghost"
                disabled={index === keys.length - 1}
                onPress={() => move(key, 1)}
              />
            </View>
          </Card>
        ))}
      </Section>
    </>
  );
}
