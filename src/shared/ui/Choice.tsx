import { Pressable, View } from 'react-native';
import { useTheme, radius } from '@/shared/theme';
import { Text } from './Text';
import { Icon } from './Icon';
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  layout = 'list',
}: {
  disabled?: boolean;
  layout?: 'list' | 'grid';
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        gap: 4,
        flexDirection: layout === 'grid' ? 'row' : 'column',
        flexWrap: layout === 'grid' ? 'wrap' : 'nowrap',
      }}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ checked: value === option.value, disabled }}
          disabled={disabled}
          onPress={() => onChange(option.value)}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 14,
            minHeight: 50,
            ...(layout === 'grid' ? { flexGrow: 1, flexBasis: 130 } : {}),
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderRadius: radius.sm,
            backgroundColor: value === option.value ? colors.inset : 'transparent',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ flex: 1, fontWeight: value === option.value ? '600' : '400' }}>
            {option.label}
          </Text>
          <Icon
            name={value === option.value ? 'check-circle' : 'circle'}
            size={20}
            color={value === option.value ? colors.primary : colors.muted}
          />
        </Pressable>
      ))}
    </View>
  );
}
