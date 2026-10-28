import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
const A = 'a2222222-2222-4222-8222-222222222222',
  B = 'b2222222-2222-4222-8222-222222222222',
  CAR = 'c2222222-2222-4222-8222-222222222222',
  SA = 'd2222222-2222-4222-8222-222222222222',
  SB = 'e2222222-2222-4222-8222-222222222222';
const FILTER = 'f2222222-2222-4222-8222-222222222222';
test('push schema scopes devices to live owner sessions, claims latest reminders once and respects timezone/deadline revisions', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade);create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.jwt(),auth.uid() to authenticated;insert into auth.users values('${A}'),('${B}');insert into auth.sessions values('${SA}','${A}'),('${SB}','${B}');`,
    );
    for (const name of [
      '202610280001_garage',
      '202610280002_logbook_details',
      '202610280006_push_reminders',
      '202610280009_push_delivery_upgrade',
    ])
      await db.exec(
        await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'),
      );
    async function claims(sub: string, sid: string) {
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub, session_id: sid }),
      ]);
    }
    await db.exec('set role authenticated');
    await claims(A, SA);
    await assert.rejects(db.exec(`select register_push_device('bad','Europe/Kyiv','uk','ios')`));
    await assert.rejects(
      db.exec(
        `select register_push_device('ExpoPushToken[aaaaaaaaaaaa]','Invalid/Timezone','uk','ios')`,
      ),
    );
    await claims(A, SB);
    await assert.rejects(
      db.exec(
        `select register_push_device('ExpoPushToken[aaaaaaaaaaaa]','Europe/Kyiv','uk','ios')`,
      ),
    );
    await claims(A, SA);
    await db.exec(`select register_push_device('ExpoPushToken[aaaaaaaaaaaa]','Europe/Kyiv','uk','ios');insert into vehicles(id,make,model,year,mileage) values('${CAR}','Own','Car',2020,1000);
 insert into service_entries(id,vehicle_id,date,odometer,title,category,total,next_date,next_odometer) values
 (gen_random_uuid(),'${CAR}','2026-09-01',900,'Old oil','oil',1,'2026-10-01',null),
 (gen_random_uuid(),'${CAR}','2026-10-02',1000,'New oil without reminder','oil',1,null,null),
 ('${FILTER}','${CAR}','2026-10-02',1000,'Filters','filters',1,'2026-11-01',3000),
 (gen_random_uuid(),'${CAR}','2026-10-02',1000,'Tire check','other',1,null,1400);`);
    await assert.rejects(db.exec(`select * from claim_service_reminders()`));
    await claims(B, SB);
    assert.equal((await db.query('select * from push_devices')).rows.length, 0);
    await db.exec(
      `select set_push_device_enabled('ExpoPushToken[aaaaaaaaaaaa]',false);select register_push_device('ExpoPushToken[bbbbbbbbbbbb]','Asia/Kathmandu','en','android')`,
    );
    await db.exec('reset role;set role service_role');
    const claim = (at: string) =>
      db.query<{ reminder_state: string; service_entry_id: string; expo_push_token: string }>(
        'select * from claim_service_reminders(100,$1)',
        [at],
      );
    assert.equal((await claim('2026-10-28T06:00:00Z')).rows.length, 0);
    const first = (await claim('2026-10-28T07:00:00Z')).rows;
    assert.equal(first.length, 2);
    assert.ok(
      first.every(
        (row) =>
          row.reminder_state === 'soon' && row.expo_push_token === 'ExpoPushToken[aaaaaaaaaaaa]',
      ),
    );
    assert.equal((await claim('2026-10-28T07:15:00Z')).rows.length, 0);
    await db.exec(`reset role;set role authenticated`);
    await claims(A, SA);
    await db.exec(
      `update vehicles set mileage=1450 where id='${CAR}';reset role;set role service_role`,
    );
    assert.equal(
      (await claim('2026-10-28T07:30:00Z')).rows.filter((row) => row.reminder_state === 'overdue')
        .length,
      1,
    );
    await db.exec(`reset role;set role authenticated`);
    await claims(A, SA);
    await db.exec(
      `update service_entries set next_date='2026-11-15' where id='${FILTER}';reset role;set role service_role`,
    );
    assert.equal((await claim('2026-10-28T07:45:00Z')).rows.length, 1);
    await db.exec(`reset role;delete from auth.sessions where id='${SA}'`);
    assert.equal((await db.query('select * from push_devices')).rows.length, 1);
    assert.equal((await db.query('select * from service_reminder_deliveries')).rows.length, 0);
    await db.exec('set role anon');
    await assert.rejects(db.exec('select * from push_devices'));
    await assert.rejects(db.exec('select * from claim_service_reminders()'));
  } finally {
    await db.close();
  }
});
