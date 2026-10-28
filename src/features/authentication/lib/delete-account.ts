type User = { id: string; email?: string };
export type DeletionClient = {
  auth: {
    getUser: () => PromiseLike<{ data: { user: User | null }; error: unknown }>;
    signInWithPassword: (input: {
      email: string;
      password: string;
    }) => PromiseLike<{ data: { user: User | null }; error: unknown }>;
  };
  rpc: (
    name: string,
    args: { p_confirmation: string; p_expected_user: string },
  ) => PromiseLike<{ error: unknown }>;
};
// The server also checks the signed JWT's recent password AMR and live session id.
export async function deleteAccountWithPassword(
  client: DeletionClient,
  expectedUserId: string,
  password: string,
) {
  const current = await client.auth.getUser();
  if (current.error || current.data.user?.id !== expectedUserId || !current.data.user.email)
    throw new Error('Session changed');
  const signed = await client.auth.signInWithPassword({ email: current.data.user.email, password });
  if (signed.error || signed.data.user?.id !== expectedUserId)
    throw new Error('Reauthentication failed');
  const result = await client.rpc('delete_own_account', {
    p_confirmation: 'DELETE_MY_ACCOUNT',
    p_expected_user: expectedUserId,
  });
  if (result.error) throw new Error('Account deletion failed');
}
