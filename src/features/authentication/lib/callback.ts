export type AuthCallback = { code: string; flowId?: string };
// Only PKCE callbacks issued to this app are accepted. Never accept bearer tokens from a URL.
export function parseAuthCallback(raw: string, webOrigin?: string): AuthCallback | null {
  try {
    const url = new URL(raw);
    const native =
      url.protocol === 'mygarage:' &&
      ((url.hostname === 'auth' && url.pathname === '/callback') ||
        (!url.hostname && url.pathname === '/auth/callback'));
    const web = Boolean(webOrigin && url.origin === webOrigin && url.pathname === '/auth/callback');
    if ((!native && !web) || url.username || url.password || url.hash) return null;
    const keys = [...url.searchParams.keys()];
    if (
      keys.some((key) => !['code', 'sb_flow_id'].includes(key)) ||
      new Set(keys).size !== keys.length
    )
      return null;
    const code = url.searchParams.get('code');
    const flowId = url.searchParams.get('sb_flow_id');
    if (!code || !/^[a-zA-Z0-9_-]{16,512}$/.test(code)) return null;
    if (flowId !== null && !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId)) return null;
    return { code, ...(flowId ? { flowId } : {}) };
  } catch {
    return null;
  }
}
export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
export function validNewPassword(password: string, repeat: string) {
  return password.length >= 8 && password === repeat;
}
export function authErrorKey(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'secure_context_required') return 'secureConnectionRequired' as const;
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit')
    return 'authRateLimit' as const;
  if (code === 'email_not_confirmed') return 'emailNotConfirmed' as const;
  if (code === 'same_password' || code === 'weak_password') return 'passwordRejected' as const;
  return 'authFailed' as const;
}
