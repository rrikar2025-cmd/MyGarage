import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { useTheme } from '@/shared/theme';
export type IconName = ComponentProps<typeof Feather>['name'];
export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <Feather
      name={name}
      size={size}
      color={color ?? colors.text}
      accessible={false}
      aria-hidden={true}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
