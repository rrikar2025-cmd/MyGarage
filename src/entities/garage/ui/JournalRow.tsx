import { View } from 'react-native';
import { useTranslation } from '@/shared/i18n';
import { formatNumber, formatDateOnly } from '@/shared/lib';
import { Button, Card, Icon, Text } from '@/shared/ui';
import type { JournalEntry } from '../model/types';
export function JournalRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useTranslation();
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Icon name={entry.kind === 'fuel' ? 'droplet' : 'tool'} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontWeight: '700' }}>
            {entry.kind === 'fuel'
              ? `${t('fuel')} · ${formatNumber(entry.data.liters, locale, 3)} ${t('litersUnit')}`
              : entry.data.title}
          </Text>
          <Text muted variant="caption">
            {formatDateOnly(entry.data.date, locale)} · {formatNumber(entry.data.odometer, locale)}{' '}
            {t('km')}
          </Text>
          <Text style={{ fontWeight: '600' }}>
            {formatNumber(entry.data.total, locale, 2, 2)} ₴
          </Text>
          {entry.kind === 'fuel' && (
            <Text muted variant="caption">
              {t(entry.data.fuel_type ?? 'unknown')} · {t('fullTankColumn')}:{' '}
              {t(entry.data.full_tank ? 'yes' : 'no')} ·{' '}
              {formatNumber(entry.data.total / entry.data.liters, locale, 2, 2)} ₴/{t('litersUnit')}
            </Text>
          )}
          {entry.kind === 'service' && entry.data.notes ? (
            <Text muted variant="caption">
              {entry.data.notes}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
        <Button label={t('edit')} variant="ghost" onPress={onEdit} />
        <Button label={t('delete')} variant="danger" onPress={onDelete} />
      </View>
    </Card>
  );
}
