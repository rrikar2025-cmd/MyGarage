import { View } from 'react-native';
import {
  getReportRange,
  shiftReportPeriod,
  localDate,
  type ReportPeriod,
  type ReportMode,
} from '@/entities/garage';
import { useTranslation } from '@/shared/i18n';
import { Button, Text } from '@/shared/ui';
export function PeriodSelector({
  period,
  onChange,
}: {
  period: ReportPeriod;
  onChange: (value: ReportPeriod) => void;
}) {
  const { t, locale } = useTranslation();
  const today = localDate();
  const title = new Intl.DateTimeFormat(
    locale === 'uk' ? 'uk-UA' : 'en-GB',
    period.mode === 'year' ? { year: 'numeric' } : { month: 'long', year: 'numeric' },
  ).format(new Date(`${period.anchor}T12:00:00`));
  const isCalendar = period.mode === 'month' || period.mode === 'year';
  const next = shiftReportPeriod(period, 1);
  const previous = shiftReportPeriod(period, -1);
  return (
    <View style={{ gap: 12 }}>
      <View
        accessibilityLabel={t('reportPeriod')}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
      >
        {(['month', 'year', 'last30', 'last12'] as ReportMode[]).map((mode) => (
          <Button
            key={mode}
            label={t(mode === 'month' ? 'byMonth' : mode === 'year' ? 'byYear' : mode)}
            variant={period.mode === mode ? 'secondary' : 'ghost'}
            accessibilityState={{ selected: period.mode === mode }}
            onPress={() => onChange({ ...period, mode })}
          />
        ))}
      </View>
      {isCalendar && (
        <View style={{ gap: 8 }}>
          <Text variant="heading" style={{ textAlign: 'center' }}>
            {title}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                label={t('previousPeriod')}
                icon="chevron-left"
                variant="ghost"
                disabled={getReportRange(previous).from < '1886-01-01'}
                onPress={() => onChange(previous)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t('nextPeriod')}
                icon="chevron-right"
                variant="ghost"
                disabled={getReportRange(next).from > today}
                onPress={() => onChange(next)}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
