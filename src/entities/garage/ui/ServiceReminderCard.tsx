import { View } from 'react-native';
import { useTranslation } from '@/shared/i18n';
import { formatNumber, formatDateOnly } from '@/shared/lib';
import { useTheme } from '@/shared/theme';
import { Button, Card, Icon, Text } from '@/shared/ui';
import type { ServiceReminder } from '../lib/service-schedule';
export function ServiceReminderCard({
  reminder,
  onEdit,
}: {
  reminder: ServiceReminder;
  onEdit?: () => void;
}) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const { entry, status, remainingKm, remainingDays } = reminder;
  const tone =
    status === 'overdue' ? colors.danger : status === 'soon' ? colors.warning : colors.primary;
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Icon name={status === 'overdue' ? 'alert-circle' : 'tool'} color={tone} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="caption" color={tone} style={{ fontWeight: '700' }}>
            {t(status)}
          </Text>
          <Text variant="heading">{entry.title}</Text>
          <Text muted variant="caption">
            {t('serviceLastDone')}: {formatDateOnly(entry.date, locale)} ·{' '}
            {formatNumber(entry.odometer, locale)} {t('km')}
          </Text>
          {entry.next_odometer !== null && (
            <Text>
              {t('atMileage')} {formatNumber(entry.next_odometer, locale)} {t('km')}
            </Text>
          )}
          {entry.next_date && (
            <Text>
              {t('serviceAtDate')} {formatDateOnly(entry.next_date, locale)}
            </Text>
          )}
          {remainingKm !== null && (
            <Text muted variant="caption">
              {t(remainingKm < 0 ? 'overdueKm' : 'remainingKm')}:{' '}
              {formatNumber(Math.abs(remainingKm), locale)}
            </Text>
          )}
          {remainingDays !== null && (
            <Text muted variant="caption">
              {t(remainingDays < 0 ? 'daysOverdue' : 'daysRemaining')}: {Math.abs(remainingDays)}
            </Text>
          )}
        </View>
      </View>
      {onEdit && <Button label={t('editEntry')} variant="ghost" onPress={onEdit} />}
    </Card>
  );
}
