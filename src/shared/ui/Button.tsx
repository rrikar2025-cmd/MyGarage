import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';
import { useTheme, radius } from '@/shared/theme';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
type Props = Omit<PressableProps, 'children' | 'onPress'> & {
  label: string;
  onPress: NonNullable<PressableProps['onPress']>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
  icon?: IconName;
};
export function Button({
  label,
  variant = 'primary',
  busy,
  icon,
  disabled,
  accessibilityState,
  accessibilityLabel,
  style,
  ...props
}: Props) {
  const { colors } = useTheme();
  const foreground =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'danger'
        ? colors.danger
        : colors.primary;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      aria-pressed={
        typeof accessibilityState?.selected === 'boolean' ? accessibilityState.selected : undefined
      }
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ ...accessibilityState, disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      style={(state) => [
        {
          minHeight: 50,
          borderRadius: radius.sm,
          paddingHorizontal: 18,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            variant === 'primary'
              ? colors.primary
              : variant === 'ghost'
                ? 'transparent'
                : colors.inset,
          opacity: disabled ? 0.45 : state.pressed ? 0.72 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          opacity: busy ? 0 : 1,
          maxWidth: '100%',
        }}
      >
        {icon && <Icon name={icon} size={19} color={foreground} />}
        <Text color={foreground} style={{ fontWeight: '600', textAlign: 'center', flexShrink: 1 }}>
          {label}
        </Text>
      </View>
      {busy && <ActivityIndicator color={foreground} style={{ position: 'absolute' }} />}
    </Pressable>
  );
}
