import test from 'node:test';
import assert from 'node:assert/strict';
import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const A = '71111111-1111-4111-8111-111111111111',
  B = '72222222-2222-4222-8222-222222222222';
const SESSION = '73333333-3333-4333-8333-333333333333';
const CAR = '74444444-4444-4444-8444-444444444444';
test('account deletion requires owner session, fresh password AMR and confirmation; cascades only owner data', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key);
   create table auth.sessions(id uuid primary key, user_id uuid references auth.users on delete cascade);
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
   grant usage on schema auth,public to authenticated; grant execute on function auth.jwt(),auth.uid() to authenticated;
   insert into auth.users values ('${A}'),('${B}'); insert into auth.sessions values ('${SESSION}','${A}');`);
    for (const name of [
      '202610280001_garage',
      '202610280002_logbook_details',
      '202610280003_account_deletion',
    ])
      await db.exec(
        await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'),
      );
    async function claims(sub: string, session_id: string | null, age = 0, method = 'password') {
      await db.query(`select set_config('request.jwt.claims', $1, false)`, [
        JSON.stringify({
          sub,
          session_id,
          amr: [{ method, timestamp: Math.floor(Date.now() / 1000) - age }],
        }),
      ]);
    }
    await claims(A, SESSION);
    await db.exec('set role authenticated;');
    await db.exec(
      `insert into vehicles(id,make,model,year) values ('${CAR}','Test','Owner',2020); insert into fuel_entries(id,vehicle_id,date,odometer,liters,total) values (gen_random_uuid(),'${CAR}','2026-10-01',1000,10,600); insert into service_entries(id,vehicle_id,date,odometer,title,category,total) values (gen_random_uuid(),'${CAR}','2026-10-01',1000,'Oil','oil',500); insert into diagnostic_scans(id,vehicle_id,stored,pending,permanent,metrics) values (gen_random_uuid(),'${CAR}','{}','{}','{}','{}');`,
    );
    await assert.rejects(db.exec(`select delete_own_account('WRONG','${A}')`));
    await assert.rejects(db.exec(`select delete_own_account('DELETE_MY_ACCOUNT','${B}')`));
    await claims(A, SESSION, 301);
    await assert.rejects(db.exec(`select delete_own_account('DELETE_MY_ACCOUNT','${A}')`));
    await claims(A, SESSION, 0, 'otp');
    await assert.rejects(db.exec(`select delete_own_account('DELETE_MY_ACCOUNT','${A}')`));
    await claims(B, SESSION);
    await assert.rejects(db.exec(`select delete_own_account('DELETE_MY_ACCOUNT','${A}')`));
    await claims(A, null);
    await assert.rejects(db.exec(`select delete_own_account('DELETE_MY_ACCOUNT','${A}')`));
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.exec(`select public.delete_own_account('DELETE_MY_ACCOUNT','${A}')`));
    await db.exec('reset role; set role authenticated;');
    await claims(A, SESSION);
    await db.exec(`select delete_own_account('DELETE_MY_ACCOUNT','${A}')`);
    await assert.rejects(db.exec(`select delete_own_account('DELETE_MY_ACCOUNT','${A}')`));
    await db.exec('reset role;');
    assert.deepEqual((await db.query('select id from auth.users')).rows, [{ id: B }]);
    for (const table of [
      'auth.sessions',
      'vehicles',
      'fuel_entries',
      'service_entries',
      'diagnostic_scans',
    ])
      assert.equal((await db.query(`select * from ${table}`)).rows.length, 0, table);
  } finally {
    await db.close();
  }
});
