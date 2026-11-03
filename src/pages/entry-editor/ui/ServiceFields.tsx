import type { Ref } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTranslation } from '@/shared/i18n';
import { Field, Text, Icon } from '@/shared/ui';
import { radius, useTheme } from '@/shared/theme';
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
  const { colors } = useTheme();
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
      <Text muted variant="caption">
        {t('serviceCategoriesHint')}
      </Text>
      {(['oil', 'filters', 'tires', 'brakes', 'other'] as const).map((value) => {
        const checked = form.categories.includes(value);
        return (
          <Pressable
            key={value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: busy }}
            accessibilityLabel={t(value)}
            disabled={busy}
            onPress={() =>
              update(
                'categories',
                checked
                  ? form.categories.length > 1
                    ? form.categories.filter((item) => item !== value)
                    : form.categories
                  : [...form.categories, value],
              )
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 14,
              minHeight: 50,
              borderRadius: radius.sm,
              backgroundColor: checked ? colors.inset : 'transparent',
            }}
          >
            <Text style={{ flex: 1, fontWeight: checked ? '600' : '400' }}>{t(value)}</Text>
            <Icon
              name={checked ? 'check-square' : 'square'}
              size={20}
              color={checked ? colors.primary : colors.muted}
            />
          </Pressable>
        );
      })}
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
