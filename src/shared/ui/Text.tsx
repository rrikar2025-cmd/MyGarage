import { Text as NativeText, type TextProps } from 'react-native';
import { useTheme, fonts } from '@/shared/theme';
type Props = TextProps & {
  variant?: 'title' | 'heading' | 'body' | 'caption' | 'eyebrow' | 'data';
  muted?: boolean;
  color?: string;
};
const type = {
  title: { fontSize: 30, lineHeight: 37, fontWeight: '700' as const, letterSpacing: -1 },
  heading: { fontSize: 20, lineHeight: 27, fontWeight: '700' as const, letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 13, lineHeight: 19 },
  eyebrow: { fontSize: 11, lineHeight: 17, fontWeight: '700' as const, letterSpacing: 1.7 },
  data: { fontSize: 29, lineHeight: 38, fontWeight: '600' as const, letterSpacing: -1 },
};
export function Text({ variant = 'body', muted, color, style, ...props }: Props) {
  const { colors } = useTheme();
  return (
    <NativeText
      {...props}
      style={[
        {
          color: color ?? (muted ? colors.muted : colors.text),
          fontFamily: variant === 'data' ? fonts.data : fonts.body,
        },
        type[variant],
        style,
      ]}
    />
  );
}
