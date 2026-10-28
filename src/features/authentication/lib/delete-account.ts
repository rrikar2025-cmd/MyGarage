type User = { id: string; email?: string };
export type DeletionClient = {
  auth: {
    getUser: () => PromiseLike<{ data: { user: User | null }; error: unknown }>;
    signInWithPassword: (input: {
      email: string;
      password: string;
    }) => PromiseLike<{ data: { user: User | null }; error: unknown }>;
  };
  functions: {
    invoke: (
      name: string,
      options: { body: { confirmation: string; expectedUserId: string } },
    ) => PromiseLike<{ data: { deleted?: boolean } | null; error: unknown }>;
  };
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
  const result = await client.functions.invoke('delete-account', {
    body: { confirmation: 'DELETE_MY_ACCOUNT', expectedUserId },
  });
  if (result.error || !result.data?.deleted) throw new Error('Account deletion failed');
}
