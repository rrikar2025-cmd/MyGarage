import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewProps,
} from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, radius } from '@/shared/theme';
import { useTranslation } from '@/shared/i18n';
import { Text } from './Text';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
export function Screen({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 32,
          paddingHorizontal: 20,
          gap: 24,
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle && <Text muted>{subtitle}</Text>}
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Card({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[
        { backgroundColor: colors.surface, borderRadius: radius.md, padding: 20, gap: 16 },
        style,
      ]}
    />
  );
}
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}
export function EmptyState({
  title,
  description,
  icon = 'inbox',
  children,
}: {
  title: string;
  description: string;
  icon?: IconName;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingVertical: 28, alignItems: 'center' }}>
      <View style={{ padding: 16, backgroundColor: colors.inset, borderRadius: radius.md }}>
        <Icon name={icon} size={28} color={colors.primary} />
      </View>
      <Text variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text muted style={{ textAlign: 'center', maxWidth: 440 }}>
        {description}
      </Text>
      {children}
    </Card>
  );
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'error' | 'success';
}) {
  const { colors } = useTheme();
  const color =
    tone === 'error' ? colors.danger : tone === 'success' ? colors.success : colors.muted;
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        gap: 10,
        padding: 16,
        borderRadius: radius.sm,
        backgroundColor: colors.inset,
      }}
    >
      <Icon
        name={tone === 'error' ? 'alert-circle' : tone === 'success' ? 'check-circle' : 'info'}
        color={color}
        size={19}
      />
      <Text style={{ flex: 1 }} color={color} variant="caption">
        {children}
      </Text>
    </View>
  );
}
export function Loading() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ padding: 40, gap: 16, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
      <Text muted>{t('loading')}</Text>
    </View>
  );
}
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Notice tone="error">{t('loadFailed')}</Notice>
      <Button label={t('retry')} onPress={onRetry} />
    </Card>
  );
}
