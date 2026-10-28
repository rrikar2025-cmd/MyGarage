import { View } from 'react-native';
import type { ExpenseBucket } from '@/entities/garage';
import { useTranslation } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib';
import { useTheme, radius } from '@/shared/theme';
import { Text } from '@/shared/ui';
export function ExpenseBars({ buckets }: { buckets: ExpenseBucket[] }) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const max = Math.max(...buckets.map((x) => x.total), 1);
  const format = new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });
  return (
    <View style={{ gap: 14 }}>
      {buckets.map((b) => {
        const label =
          b.granularity === 'month'
            ? new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-GB', {
                month: 'short',
                year: 'numeric',
              }).format(new Date(`${b.from}T12:00:00`))
            : `${format.format(new Date(`${b.from}T12:00:00`))} – ${format.format(new Date(`${b.to}T12:00:00`))}`;
        return (
          <View
            key={b.key}
            accessible
            accessibilityLabel={`${label}. ${t('fuel')}: ${formatNumber(b.fuel, locale, 2, 2)} ₴. ${t('service')}: ${formatNumber(b.service, locale, 2, 2)} ₴.`}
            style={{ gap: 6 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text variant="caption" muted style={{ flex: 1 }}>
                {label}
              </Text>
              <Text variant="caption" style={{ fontWeight: '600' }}>
                {formatNumber(b.total, locale, 2, 2)} ₴
              </Text>
            </View>
            <View
              accessibilityElementsHidden
              aria-hidden
              style={{
                height: 12,
                backgroundColor: colors.inset,
                borderRadius: radius.pill,
                overflow: 'hidden',
                flexDirection: 'row',
              }}
            >
              <View
                style={{ width: `${(b.fuel / max) * 100}%`, backgroundColor: colors.primary }}
              />
              <View
                style={{
                  width: `${(b.service / max) * 100}%`,
                  backgroundColor: colors.chartSecondary,
                }}
              />
            </View>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
        {(['fuel', 'service'] as const).map((key) => (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                height: 10,
                width: 10,
                borderRadius: 3,
                backgroundColor: key === 'fuel' ? colors.primary : colors.chartSecondary,
              }}
            />
            <Text variant="caption" muted>
              {t(key)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
