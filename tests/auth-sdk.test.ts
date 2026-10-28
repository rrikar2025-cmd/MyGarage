import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
// Contract tests use the installed Supabase SDK and an in-memory HTTP double. No email is sent.
function harness(name: string) {
  const storage = new Map<string, string>();
  const events: string[] = [];
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  const payload = {
    sub: 'a1111111-1111-4111-8111-111111111111',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.test-signature`;
  const user = {
    id: payload.sub,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'contract@example.invalid',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const client = createClient('https://contract.example.invalid', 'test-publishable-key', {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: name,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
    },
    global: {
      fetch: async (input, init) => {
        const path = new URL(String(input)).pathname;
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        requests.push({ path, body });
        if (path === '/auth/v1/token')
          return new Response(
            JSON.stringify({
              access_token: token,
              refresh_token: 'test-refresh',
              token_type: 'bearer',
              expires_in: 3600,
              user,
            }),
            { headers: { 'Content-Type': 'application/json' } },
          );
        if (path === '/auth/v1/logout') return new Response(null, { status: 204 });
        if (path === '/auth/v1/recover')
          return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
        throw new Error('Unexpected mock request');
      },
    },
  });
  const subscription = client.auth.onAuthStateChange((event) => {
    events.push(event);
  }).data.subscription;
  return { client, storage, events, requests, subscription };
}
test('SDK recovery uses S256, emits PASSWORD_RECOVERY and persists the session and clears it on local logout', async () => {
  const h = harness('contract-recovery');
  try {
    const sent = await h.client.auth.resetPasswordForEmail('contract@example.invalid', {
      redirectTo: 'mygarage://auth/callback',
    });
    assert.equal(sent.error, null);
    const recover = h.requests.find((r) => r.path.endsWith('/recover'))!;
    assert.equal(recover.body.code_challenge_method, 's256');
    const stored = JSON.parse(h.storage.get('contract-recovery-code-verifier')!) as string;
    const [verifier] = stored.split('/');
    assert.equal(
      recover.body.code_challenge,
      createHash('sha256').update(verifier!).digest('base64url'),
    );
    const exchanged = await h.client.auth.exchangeCodeForSession('test-one-time-code');
    assert.equal(exchanged.error, null);
    assert.ok(h.events.includes('PASSWORD_RECOVERY'));
    assert.equal(h.requests.find((r) => r.path.endsWith('/token'))?.body.code_verifier, verifier);
    assert.equal((await h.client.auth.getSession()).data.session?.user.id, exchanged.data.user?.id);
    assert.ok(h.storage.has('contract-recovery'));
    await h.client.auth.signOut({ scope: 'local' });
    assert.equal((await h.client.auth.getSession()).data.session, null);
    assert.equal(h.storage.has('contract-recovery'), false);
  } finally {
    h.subscription.unsubscribe();
  }
});
test('SDK rejects a callback opened without its original verifier before an HTTP exchange', async () => {
  const h = harness('contract-missing-verifier');
  try {
    const result = await h.client.auth.exchangeCodeForSession('test-one-time-code');
    assert.ok(result.error);
    assert.equal(h.requests.length, 0);
    assert.equal((await h.client.auth.getSession()).data.session, null);
  } finally {
    h.subscription.unsubscribe();
  }
});
