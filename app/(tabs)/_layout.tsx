import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '@/shared/theme';
import { useTranslation } from '@/shared/i18n';
import { Icon, type IconName } from '@/shared/ui';
const screens = [
  { name: 'index', label: 'overview', icon: 'grid' },
  { name: 'garage', label: 'garage', icon: 'truck' },
  { name: 'journal', label: 'journal', icon: 'book-open' },
  { name: 'diagnostics', label: 'diagnostics', icon: 'activity' },
  { name: 'settings', label: 'settings', icon: 'sliders' },
] as const;
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.2;
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64 + Math.max(insets.bottom, 14),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 14),
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 4 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {screens.map((s) => (
        <Tabs.Screen
          key={s.name}
          name={s.name}
          options={{
            title: t(s.label),
            tabBarLabel: compact
              ? t(
                  s.label === 'journal'
                    ? 'navJournal'
                    : s.label === 'diagnostics'
                      ? 'navDiagnostics'
                      : s.label === 'settings'
                        ? 'navSettings'
                        : s.label,
                )
              : t(s.label),
            tabBarAccessibilityLabel: compact
              ? `${t(s.label === 'journal' ? 'navJournal' : s.label === 'diagnostics' ? 'navDiagnostics' : s.label === 'settings' ? 'navSettings' : s.label)} · ${t(s.label)}`
              : t(s.label),
            tabBarIcon: ({ color }) => <Icon name={s.icon as IconName} size={22} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
