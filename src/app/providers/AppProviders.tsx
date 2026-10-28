import { useEffect, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { synchronizePushDevice } from '@/features/push-notifications';
import { useSession } from '@/entities/session';
import { useGarage } from '@/entities/garage';
import { startTelemetry, stopAdapterSearch, disconnectAdapter } from '@/entities/obd';
import { Loading } from '@/shared/ui';
import { supabase } from '@/shared/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function AppProviders({ children }: { children: ReactNode }) {
  const garageOwner = useGarage((s) => s.owner);
  const ready = useSession((s) => s.ready);
  const owner = useSession((s) => s.session?.user.id ?? null);
  useEffect(() => {
    const handled = new Set<string>();
    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const identifier = response.notification.request.identifier;
      if (handled.has(identifier)) return;
      handled.add(identifier);
      if (response.notification.request.content.data?.type === 'service-reminder') {
        router.push('/service');
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        handleResponse(response);
        if (response) void Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => {});
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!supabase) {
      useSession.getState().set(null);
      return;
    }
    let active = true;
    let receivedEvent = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      receivedEvent = true;
      if (active) {
        useSession.getState().set(session);
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT')
          useSession.getState().setRecovery(null);
        if (event === 'PASSWORD_RECOVERY')
          useSession.getState().setRecovery(session?.user.id ?? null);
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !receivedEvent) useSession.getState().set(data.session, Boolean(error));
      })
      .catch(() => {
        if (active && !receivedEvent) useSession.getState().set(null, true);
      });
    if (Platform.OS !== 'web') supabase.auth.startAutoRefresh();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase?.auth.startAutoRefresh();
      else {
        supabase?.auth.stopAutoRefresh();
        void stopAdapterSearch().catch(() => {});
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      appState.remove();
      supabase?.auth.stopAutoRefresh();
    };
  }, []);
  useEffect(() => {
    if (ready) {
      void useGarage.getState().load(owner);
      void disconnectAdapter().catch(() => {});
    }
  }, [ready, owner]);
  useEffect(() => {
    if (!owner || Platform.OS === 'web') return;
    const synchronize = () => {
      void synchronizePushDevice(owner).catch(() => {});
    };
    synchronize();
    const active = AppState.addEventListener('change', (state) => {
      if (state === 'active') synchronize();
    });
    const token = Notifications.addPushTokenListener(synchronize);
    return () => {
      active.remove();
      token.remove();
    };
  }, [owner]);
  useEffect(() => startTelemetry(), []);
  return (
    <SafeAreaProvider>{ready && garageOwner !== owner ? <Loading /> : children}</SafeAreaProvider>
  );
}
