import { forwardRef, useMemo, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useTranslation } from '@/shared/i18n';
import { radius, useTheme } from '@/shared/theme';
import { Field, Text } from '@/shared/ui';

type Props = {
  label: string;
  placeholder: string;
  value: string;
  options: readonly string[];
  open: boolean;
  disabled: boolean;
  maxLength: number;
  keyboardType?: KeyboardTypeOptions;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
};

export const VehicleAutocomplete = forwardRef<TextInput, Props>(function VehicleAutocomplete(
  {
    label,
    placeholder,
    value,
    options,
    open,
    disabled,
    maxLength,
    keyboardType,
    onChange,
    onOpenChange,
  },
  ref,
) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const matches = useMemo(() => {
    const query = showAll ? '' : value.trim().toLocaleLowerCase();
    return query ? options.filter((option) => option.toLocaleLowerCase().includes(query)) : options;
  }, [options, showAll, value]);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            ref={ref}
            label={label}
            placeholder={placeholder}
            value={value}
            editable={!disabled}
            maxLength={maxLength}
            keyboardType={keyboardType}
            onFocus={() => {
              setShowAll(false);
              onOpenChange(true);
            }}
            onChangeText={(text) => {
              setShowAll(false);
              onChange(text);
              onOpenChange(true);
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t(open ? 'closeOptions' : 'showOptions')}: ${label}`}
          accessibilityState={{ expanded: open, disabled }}
          disabled={disabled}
          onPress={() => {
            Keyboard.dismiss();
            if (!open) setShowAll(true);
            onOpenChange(!open);
          }}
          style={{
            minWidth: 50,
            minHeight: 50,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
          }}
        >
          <Text color={colors.primary}>{open ? '▴' : '▾'}</Text>
        </Pressable>
      </View>
      {open && !disabled && (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            overflow: 'hidden',
            backgroundColor: colors.surface,
          }}
        >
          {matches.length ? (
            <ScrollView
              style={{ maxHeight: 200 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="always"
            >
              {matches.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(option);
                    onOpenChange(false);
                    Keyboard.dismiss();
                  }}
                  style={{
                    minHeight: 44,
                    justifyContent: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text muted variant="caption" style={{ padding: 14 }}>
              {t('noVehicleOptions')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});
