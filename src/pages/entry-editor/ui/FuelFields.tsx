import { View } from 'react-native';
import { useTranslation } from '@/shared/i18n';
import { parseDecimal } from '@/entities/garage';
import { formatNumber } from '@/shared/lib';
import { Choice, Field, Text, Toggle } from '@/shared/ui';
import type { EntryDraft } from '../model/draft';
export type UpdateDraft = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => void;
export function FuelFields({
  form,
  update,
  busy,
}: {
  form: EntryDraft;
  update: UpdateDraft;
  busy: boolean;
}) {
  const { t, locale } = useTranslation();
  const total = parseDecimal(form.total);
  const liters = parseDecimal(form.liters);
  return (
    <View style={{ gap: 18 }}>
      <Field
        label={t('liters')}
        keyboardType="decimal-pad"
        maxLength={10}
        value={form.liters}
        onChangeText={(v) => update('liters', v)}
        editable={!busy}
      />
      <Text style={{ fontWeight: '600' }}>{t('fuelType')}</Text>
      <Choice
        label={t('fuelType')}
        value={form.fuelType}
        disabled={busy}
        onChange={(v) => update('fuelType', v)}
        options={(['unknown', 'petrol', 'diesel', 'lpg', 'other'] as const).map((value) => ({
          value,
          label: t(value),
        }))}
      />
      <Toggle
        label={t('fullTank')}
        hint={t('fullTankHint')}
        value={form.fullTank}
        onChange={(v) => update('fullTank', v)}
        disabled={busy}
      />
      {Number.isFinite(total) && Number.isFinite(liters) && liters > 0 && (
        <Text muted variant="caption">
          {t('pricePerLiter')}: {formatNumber(total / liters, locale, 2, 2)} ₴/{t('litersUnit')}
        </Text>
      )}
    </View>
  );
}
