import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { listenForAuthLinks } from '@/features/authentication';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useTheme } from '@/shared/theme';
import { useTranslation } from '@/shared/i18n';
import { useSession } from '@/entities/session';
import { Loading } from '@/shared/ui';
export function RootNavigator() {
  const { colors, mode } = useTheme();
  const { t, locale } = useTranslation();
  const ready = useSession((s) => s.ready);
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.documentElement.lang = locale;
      document.documentElement.dataset.theme = mode;
      document.documentElement.style.backgroundColor = colors.background;
      document.title = t('appName');
    }
  }, [locale, mode, colors.background, t]);
  if (!ready) return <Loading />;
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
        },
      }}
    >
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="vehicle/[id]" />
        <Stack.Screen name="entry/[kind]" />
        <Stack.Screen name="auth/index" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="auth/reset" />
        <Stack.Screen name="auth/password" />
        <Stack.Screen name="account-delete" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="service" />
        <Stack.Screen name="telemetry" />
        <Stack.Screen name="telemetry-settings" />
        <Stack.Screen name="scan/[id]" />
      </Stack>
      <AuthLinkListener />
    </ThemeProvider>
  );
}

function AuthLinkListener() {
  const state = useRootNavigationState();
  useEffect(() => {
    if (!state?.key) return;
    return listenForAuthLinks(() => router.replace('/auth/callback'));
  }, [state?.key]);
  return null;
}
