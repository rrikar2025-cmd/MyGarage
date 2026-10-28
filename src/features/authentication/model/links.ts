import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { requireCloud } from '@/shared/api';
import { useSession } from '@/entities/session';
import { parseAuthCallback, type AuthCallback } from '../lib/callback';
type LinkState = {
  status: 'empty' | 'pending' | 'busy' | 'success' | 'invalid';
  recovery: boolean;
};
export const useAuthLink = create<LinkState>(() => ({ status: 'empty', recovery: false }));
let pending: AuthCallback | null = null;
let exchange: Promise<void> | null = null;
let lastURL: string | null = null;
export function authRedirectURL() {
  return Platform.OS === 'web'
    ? `${window.location.origin}/auth/callback`
    : 'mygarage://auth/callback';
}
export function receiveAuthLink(raw: string) {
  const isCallback = (() => {
    try {
      const url = new URL(raw);
      return (
        url.pathname === '/auth/callback' ||
        (url.protocol === 'mygarage:' && url.hostname === 'auth' && url.pathname === '/callback')
      );
    } catch {
      return false;
    }
  })();
  if (!isCallback) return false;
  // Strip credentials before any network request or error rendering; keep code only in memory.
  if (Platform.OS === 'web') window.history.replaceState(null, '', '/auth/callback');
  if (raw === lastURL) return true;
  if (!new URL(raw).search && !new URL(raw).hash && useAuthLink.getState().status !== 'empty')
    return true;
  // Do not replace an exchange that is already committing a session.
  if (useAuthLink.getState().status === 'busy') return true;
  lastURL = raw;
  pending = parseAuthCallback(raw, Platform.OS === 'web' ? window.location.origin : undefined);
  exchange = null;
  useAuthLink.setState({ status: pending ? 'pending' : 'invalid', recovery: false });
  return true;
}
export function listenForAuthLinks(onLink: () => void) {
  let active = true;
  function receive(url: string) {
    if (active && receiveAuthLink(url)) onLink();
  }
  // Read web URL synchronously before the router can normalize it.
  if (Platform.OS === 'web') receive(window.location.href);
  else
    void Linking.getInitialURL()
      .then((url) => {
        if (url) receive(url);
      })
      .catch(() => {});
  const listener = Linking.addEventListener('url', ({ url }) => receive(url));
  return () => {
    active = false;
    listener.remove();
  };
}
export function consumeAuthLink() {
  if (exchange) return exchange;
  if (!pending) return Promise.resolve();
  const value = pending;
  pending = null;
  useAuthLink.setState({ status: 'busy' });
  exchange = (async () => {
    try {
      useSession.getState().setRecovery(null);
      const result = await requireCloud().auth.exchangeCodeForSession(
        value.code,
        value.flowId ? { flowId: value.flowId } : undefined,
      );
      if (result.error || !result.data.session) throw new Error('Invalid callback');
      const recovery = useSession.getState().recoveryUser === result.data.session.user.id;
      useSession.getState().setRecovery(recovery ? result.data.session.user.id : null);
      useAuthLink.setState({ status: 'success', recovery });
    } catch {
      useAuthLink.setState({ status: 'invalid', recovery: false });
    } finally {
      lastURL = null;
    }
  })();
  return exchange;
}
