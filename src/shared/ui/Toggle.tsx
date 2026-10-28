import { Switch, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Text } from './Text';
export function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ minHeight: 50, flexDirection: 'row', gap: 16, alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontWeight: '600' }}>{label}</Text>
        {hint && (
          <Text muted variant="caption">
            {hint}
          </Text>
        )}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.onPrimary : colors.surface}
      />
    </View>
  );
}
