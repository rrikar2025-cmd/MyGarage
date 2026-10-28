import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization,x-client-info,apikey,content-type,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};
const url = Deno.env.get('SUPABASE_URL')!,
  key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  const bearer = request.headers.get('Authorization') ?? '';
  if (!bearer.startsWith('Bearer ')) return reply({ error: 'unauthorized' }, 401);
  try {
    const verified = await admin.auth.getUser(bearer.slice(7));
    const actor = verified.data.user?.id;
    if (verified.error || !actor) return reply({ error: 'unauthorized' }, 401);
    const body = await request.json();
    if (body?.expectedUserId !== actor || body?.confirmation !== 'DELETE_MY_ACCOUNT')
      return reply({ error: 'not_authorized' }, 403);
    const user = createClient(url, anon, {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const prepared = await user.rpc('prepare_media_account_deletion', {
      p_confirmation: body.confirmation,
      p_expected_user: actor,
    });
    if (prepared.error) return reply({ error: 'recent_password_required' }, 403);
    // Uploads are fenced by the SQL owner lock before any files are removed.
    // API deletion removes actual bytes, unlike deleting storage.objects rows in SQL.
    for (let batch = 0; batch < 25; batch++) {
      const listed = await admin.storage
        .from('mygarage-private')
        .list(actor, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
      if (listed.error) throw listed.error;
      if (!listed.data.length) break;
      const names = listed.data.map((row) => row.name);
      if (names.some((name) => !/^[-a-f0-9]{36}\.jpg$/.test(name)))
        throw new Error('Unexpected owner folder');
      const removed = await admin.storage
        .from('mygarage-private')
        .remove(names.map((name) => `${actor}/${name}`));
      if (removed.error) throw removed.error;
      if (batch === 24) throw new Error('Cleanup did not finish');
    }
    const deleted = await user.rpc('delete_own_account', {
      p_confirmation: body.confirmation,
      p_expected_user: actor,
    });
    if (deleted.error) throw deleted.error;
    return reply({ deleted: true });
  } catch {
    return reply({ error: 'account_deletion_failed' }, 500);
  }
});
