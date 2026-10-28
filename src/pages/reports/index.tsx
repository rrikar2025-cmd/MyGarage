import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  useGarage,
  useSelectedVehicle,
  localDate,
  getReportRange,
  entriesInRange,
  sumExpenses,
  getExpenseBuckets,
  type ReportPeriod,
} from '@/entities/garage';
import { ExportJournal } from '@/features/export-journal';
import { useTranslation } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib';
import { Button, Card, EmptyState, ErrorState, Loading, Screen, Section, Text } from '@/shared/ui';
import { PeriodSelector } from './ui/PeriodSelector';
import { ExpenseBars } from './ui/ExpenseBars';
import { FuelEfficiency } from './ui/FuelEfficiency';
export function ReportsPage() {
  const { t, locale } = useTranslation();
  const vehicle = useSelectedVehicle();
  const state = useGarage();
  const [period, setPeriod] = useState<ReportPeriod>(() => ({
    mode: 'month',
    anchor: localDate(),
  }));
  const today = localDate();
  const range = useMemo(() => getReportRange(period), [period, today]);
  const entries = useMemo(
    () => entriesInRange(state.fuel, state.service, vehicle?.id ?? '', range),
    [state.fuel, state.service, vehicle?.id, range],
  );
  const totals = useMemo(() => sumExpenses(entries), [entries]);
  const buckets = useMemo(() => getExpenseBuckets(entries, range), [entries, range]);
  const format = new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    dateStyle: 'medium',
  });
  return (
    <Screen
      title={t('reports')}
      subtitle={vehicle ? `${vehicle.make} ${vehicle.model}` : undefined}
      action={<Button label={t('back')} variant="ghost" onPress={() => router.back()} />}
    >
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorState onRetry={() => void state.load(state.owner)} />
      ) : !vehicle ? (
        <EmptyState title={t('selectVehicle')} description={t('selectVehicleHint')}>
          <Button label={t('garage')} onPress={() => router.replace('/garage')} />
        </EmptyState>
      ) : (
        <>
          <PeriodSelector period={period} onChange={setPeriod} />
          <Card>
            <Text variant="eyebrow">{t('selectedPeriod')}</Text>
            <Text muted variant="caption">
              {format.format(new Date(`${range.from}T12:00:00`))} –{' '}
              {format.format(new Date(`${range.to}T12:00:00`))}
            </Text>
            <Text variant="data" style={{ fontSize: 36, lineHeight: 46 }}>
              {formatNumber(totals.total, locale, 2, 2)} <Text muted>₴</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {(['fuel', 'service'] as const).map((kind) => (
                <View key={kind} style={{ flex: 1, gap: 4 }}>
                  <Text muted variant="caption">
                    {t(kind)}
                  </Text>
                  <Text style={{ fontWeight: '700' }}>
                    {formatNumber(totals[kind], locale, 2, 2)} ₴
                  </Text>
                </View>
              ))}
            </View>
            <Text muted variant="caption">
              {t('fuelFills')}: {totals.fuelCount} · {t('serviceOperations')}: {totals.serviceCount}
            </Text>
            {totals.liters > 0 && (
              <>
                <Text>
                  {t('fuelVolume')}: {formatNumber(totals.liters, locale, 3)} {t('litersUnit')}
                </Text>
                <Text muted variant="caption">
                  {t('paidAverage')}: {formatNumber(totals.pricePerLiter!, locale, 2, 2)} ₴/
                  {t('litersUnit')}
                </Text>
              </>
            )}
          </Card>
          {!entries.length ? (
            <EmptyState title={t('noPeriodEntries')} description={t('periodEmptyHint')} />
          ) : (
            <Section title={t('expenseTrend')}>
              <Card>
                <ExpenseBars buckets={buckets} />
              </Card>
            </Section>
          )}
          <FuelEfficiency fuel={state.fuel} vehicleId={vehicle.id} range={range} />
          <ExportJournal
            key={`${state.owner}:${vehicle.id}`}
            entries={entries}
            vehicle={vehicle}
            range={range}
          />
        </>
      )}
    </Screen>
  );
}
