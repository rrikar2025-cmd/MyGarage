import { useMemo } from 'react';
import { View } from 'react-native';
import {
  getFuelCycles,
  summarizeFuelEfficiency,
  type FuelEntry,
  type DateRange,
} from '@/entities/garage';
import { useTranslation } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib';
import { Card, Text, Notice } from '@/shared/ui';
export function FuelEfficiency({
  fuel,
  vehicleId,
  range,
}: {
  fuel: FuelEntry[];
  vehicleId: string;
  range: DateRange;
}) {
  const { t, locale } = useTranslation();
  const cycles = useMemo(() => getFuelCycles(fuel, vehicleId), [fuel, vehicleId]);
  const summaries = useMemo(() => summarizeFuelEfficiency(cycles, range), [cycles, range]);
  return (
    <Card>
      <Text variant="heading">{t('fuelEfficiency')}</Text>
      {!summaries.length ? (
        <Notice>{t('efficiencyMissing')}</Notice>
      ) : (
        summaries.map((summary) => (
          <View key={summary.fuelType} style={{ gap: 6 }}>
            <Text style={{ fontWeight: '600' }}>{t(summary.fuelType)}</Text>
            <Text variant="data">
              {formatNumber(summary.litersPer100, locale, 2)}{' '}
              <Text muted variant="caption">
                {t('litersPer100')}
              </Text>
            </Text>
            <Text muted variant="caption">
              {t('distanceMeasured')}: {formatNumber(summary.distance, locale)} {t('km')} ·{' '}
              {t('completedCycles')}: {summary.count}
            </Text>
          </View>
        ))
      )}
      <Text muted variant="caption">
        {t('efficiencyHint')}
      </Text>
    </Card>
  );
}
