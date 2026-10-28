import { useId, useState, forwardRef } from 'react';
import { TextInput, View, Pressable, type TextInputProps } from 'react-native';
import { useTheme, radius } from '@/shared/theme';
import { useTranslation } from '@/shared/i18n';
import { Text } from './Text';
import { Icon } from './Icon';
export const Field = forwardRef<
  TextInput,
  TextInputProps & { label: string; secret?: boolean; error?: string; hint?: string }
>(function Field({ label, secret, error, hint, style, ...props }, ref) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text nativeID={`${id}-label`} style={{ fontWeight: '600' }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radius.sm,
          backgroundColor: colors.surface,
        }}
      >
        <TextInput
          {...props}
          ref={ref}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${id}-label`}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${id}-help` : undefined}
          secureTextEntry={secret && !visible}
          placeholderTextColor={colors.muted}
          style={[{ color: colors.text, padding: 14, minHeight: 50, flex: 1, fontSize: 16 }, style]}
        />
        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(visible ? 'hidePassword' : 'showPassword')}
            onPress={() => setVisible(!visible)}
            style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={visible ? 'eye-off' : 'eye'} size={20} />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text
          nativeID={`${id}-help`}
          color={colors.danger}
          variant="caption"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text nativeID={`${id}-help`} muted variant="caption">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
