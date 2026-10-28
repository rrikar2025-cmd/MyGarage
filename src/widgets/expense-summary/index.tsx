import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { getExpenses, useGarage } from '@/entities/garage';
import { useTranslation } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib';
import { useTheme } from '@/shared/theme';
import { Card, Text, Button, Icon } from '@/shared/ui';
export function ExpenseSummary({ vehicleId }: { vehicleId: string }) {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const fuel = useGarage((s) => s.fuel);
  const service = useGarage((s) => s.service);
  const expense = useMemo(
    () => getExpenses(fuel, service, vehicleId, period),
    [fuel, service, vehicleId, period],
  );
  return (
    <Card>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="heading">{t('expenses')}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Button
            label={t('month')}
            variant={period === 'month' ? 'secondary' : 'ghost'}
            onPress={() => setPeriod('month')}
            accessibilityState={{ selected: period === 'month' }}
          />
          <Button
            label={t('yearPeriod')}
            variant={period === 'year' ? 'secondary' : 'ghost'}
            onPress={() => setPeriod('year')}
            accessibilityState={{ selected: period === 'year' }}
          />
        </View>
      </View>
      <Text variant="data" style={{ fontSize: 34, lineHeight: 44 }}>
        {formatNumber(expense.total, locale, 2, 2)} <Text muted>₴</Text>
      </Text>
      <View style={{ flexDirection: 'row', gap: 24 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="droplet" color={colors.primary} size={16} />
            <Text variant="caption" muted>
              {t('fuel')}
            </Text>
          </View>
          <Text style={{ fontWeight: '600' }}>{formatNumber(expense.fuel, locale, 2, 2)} ₴</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="tool" color={colors.primary} size={16} />
            <Text variant="caption" muted>
              {t('service')}
            </Text>
          </View>
          <Text style={{ fontWeight: '600' }}>{formatNumber(expense.service, locale, 2, 2)} ₴</Text>
        </View>
      </View>
      <Text variant="caption" muted>
        {t('moneyHint')}
      </Text>
      <Button
        label={t('showReports')}
        variant="ghost"
        icon="bar-chart-2"
        onPress={() => router.push('/reports')}
      />
    </Card>
  );
}
