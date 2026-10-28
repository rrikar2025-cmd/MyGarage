import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAuthCallback,
  validNewPassword,
  authErrorKey,
} from '../src/features/authentication/lib/callback';
import {
  deleteAccountWithPassword,
  type DeletionClient,
} from '../src/features/authentication/lib/delete-account';
const code = '11111111-2222-4333-8444-555555555555';
test('PKCE callback accepts exact native/web routes and preserves flow slot', () => {
  assert.deepEqual(parseAuthCallback(`mygarage://auth/callback?code=${code}`), { code });
  assert.deepEqual(parseAuthCallback(`mygarage:///auth/callback?code=${code}`), { code });
  assert.deepEqual(
    parseAuthCallback(
      `http://localhost:8082/auth/callback?code=${code}&sb_flow_id=abc12345`,
      'http://localhost:8082',
    ),
    { code, flowId: 'abc12345' },
  );
});
test('PKCE callback rejects foreign origins, ambiguous parameters, tokens and error details', () => {
  for (const url of [
    `https://evil.example/auth/callback?code=${code}`,
    `mygarage://evil/auth/callback?code=${code}`,
    `mygarage://auth/callback/extra?code=${code}`,
    `mygarage://auth/callback?code=${code}&code=${code}`,
    `mygarage://auth/callback?code=${code}&next=https://evil.example`,
    `mygarage://auth/callback?code=${code}#access_token=secret`,
    'mygarage://auth/callback?error=access_denied&error_description=secret',
    `mygarage://user:secret@auth/callback?code=${code}`,
    'invalid',
  ])
    assert.equal(parseAuthCallback(url, 'http://localhost:8082'), null, url);
});
test('new passwords require matching confirmation; errors never render server details', () => {
  assert.equal(validNewPassword('long password', 'long password'), true);
  assert.equal(validNewPassword('short', 'short'), false);
  assert.equal(validNewPassword('long password', 'different'), false);
  assert.equal(authErrorKey({ message: 'secret', code: 'unexpected' }), 'authFailed');
  assert.equal(authErrorKey({ code: 'over_email_send_rate_limit' }), 'authRateLimit');
});
function clientWith(
  options: {
    currentId?: string;
    signedId?: string;
    passwordError?: boolean;
    rpcError?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const deletionFails = options.rpcError;
  const client: DeletionClient = {
    auth: {
      getUser: async () => {
        calls.push('getUser');
        return {
          data: { user: { id: options.currentId ?? 'owner', email: 'owner@example.invalid' } },
          error: null,
        };
      },
      signInWithPassword: async () => {
        calls.push('password');
        return {
          data: { user: { id: options.signedId ?? 'owner' } },
          error: options.passwordError ? {} : null,
        };
      },
    },
    functions: {
      invoke: async (name, options) => {
        calls.push('delete');
        assert.equal(name, 'delete-account');
        assert.deepEqual(options.body, {
          confirmation: 'DELETE_MY_ACCOUNT',
          expectedUserId: 'owner',
        });
        return { data: deletionFails ? null : { deleted: true }, error: deletionFails ? {} : null };
      },
    },
  };
  return { client, calls };
}
test('account deletion stops before RPC on a changed session or failed password', async () => {
  for (const options of [{ currentId: 'other' }, { signedId: 'other' }, { passwordError: true }]) {
    const { client, calls } = clientWith(options);
    await assert.rejects(deleteAccountWithPassword(client, 'owner', 'existing-password'));
    assert.ok(!calls.includes('delete'));
  }
});
test('account deletion reauthenticates first and propagates RPC failure without claiming success', async () => {
  const good = clientWith();
  await deleteAccountWithPassword(good.client, 'owner', 'existing-password');
  assert.deepEqual(good.calls, ['getUser', 'password', 'delete']);
  const failed = clientWith({ rpcError: true });
  await assert.rejects(deleteAccountWithPassword(failed.client, 'owner', 'existing-password'));
});
