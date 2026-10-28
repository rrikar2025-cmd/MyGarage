import type { Ref } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from '@/shared/i18n';
import { Choice, Field, Text } from '@/shared/ui';
import type { EntryDraft } from '../model/draft';
import type { UpdateDraft } from './FuelFields';
export function ServiceFields({
  form,
  update,
  busy,
  nextRef,
  nextDateRef,
  issue,
}: {
  nextRef?: Ref<TextInput>;
  nextDateRef?: Ref<TextInput>;
  issue?: 'nextInvalid' | 'nextDateInvalid' | null;
  form: EntryDraft;
  update: UpdateDraft;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 18 }}>
      <Field
        label={t('serviceTitle')}
        placeholder={t('serviceTitleHint')}
        maxLength={120}
        value={form.title}
        onChangeText={(v) => update('title', v)}
        editable={!busy}
      />
      <Text style={{ fontWeight: '600' }}>{t('category')}</Text>
      <Choice
        label={t('category')}
        value={form.category}
        disabled={busy}
        onChange={(v) => update('category', v)}
        options={(['oil', 'filters', 'tires', 'brakes', 'other'] as const).map((value) => ({
          value,
          label: t(value),
        }))}
      />
      <Field
        ref={nextRef}
        error={issue === 'nextInvalid' ? t(issue) : undefined}
        label={t('nextOdometer')}
        keyboardType="number-pad"
        maxLength={8}
        value={form.next}
        onChangeText={(v) => update('next', v)}
        editable={!busy}
      />
      <Field
        ref={nextDateRef}
        error={issue === 'nextDateInvalid' ? t(issue) : undefined}
        label={t('nextServiceDate')}
        placeholder="YYYY-MM-DD"
        hint={t('serviceEitherFirst')}
        maxLength={10}
        value={form.nextDate}
        onChangeText={(v) => update('nextDate', v)}
        editable={!busy}
      />
      <Field
        label={t('notes')}
        multiline
        numberOfLines={3}
        style={{ minHeight: 100, textAlignVertical: 'top' }}
        maxLength={1000}
        value={form.notes}
        onChangeText={(v) => update('notes', v)}
        editable={!busy}
      />
    </View>
  );
}
