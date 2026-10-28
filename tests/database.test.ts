import test from 'node:test';
import assert from 'node:assert/strict';
import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222';
const CAR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('actual migration enforces owner isolation, child ownership, odometer updates and cascading removal', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${A}'),('${B}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth, public to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202610280001_garage.sql', import.meta.url),
        'utf8',
      ),
    );
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${A}';`);
    await db.exec(
      `insert into public.vehicles(id,make,model,year,mileage) values ('${CAR}','BMW','320',2018,1000);`,
    );
    await db.exec(
      `insert into public.fuel_entries(id,vehicle_id,date,odometer,liters,total) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${CAR}','2026-10-01',1200,30,1800);`,
    );
    await db.exec('reset role;');
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202610280002_logbook_details.sql', import.meta.url),
        'utf8',
      ),
    );
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${A}';`);
    await db.exec('reset role;');
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202610280004_scan_context.sql', import.meta.url),
        'utf8',
      ),
    );
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${A}';`);
    await db.exec(
      `insert into diagnostic_scans(id,vehicle_id) values ('aabbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${CAR}');`,
    );
    assert.deepEqual((await db.query('select context from diagnostic_scans')).rows[0], {
      context: {},
    });
    await assert.rejects(db.exec(`update diagnostic_scans set context='[]'::jsonb`));
    await db.exec(
      `update diagnostic_scans set context='{"mode":"all","statuses":{"stored":"read"}}'::jsonb`,
    );
    const legacy = await db.query<{ fuel_type: null; full_tank: boolean }>(
      'select fuel_type, full_tank from public.fuel_entries',
    );
    assert.deepEqual(legacy.rows[0], { fuel_type: null, full_tank: false });
    await db.exec(`update public.fuel_entries set fuel_type='petrol', full_tank=true`);
    await assert.rejects(db.exec(`update public.fuel_entries set fuel_type='invalid'`));
    await assert.rejects(
      db.exec(
        `insert into public.service_entries(id,vehicle_id,date,odometer,title,category,total,next_date) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','${CAR}','2026-10-01',1200,'Oil','oil',200,'2026-09-30')`,
      ),
    );
    const advanced = await db.query<{ mileage: number }>(
      `select mileage from public.vehicles where id='${CAR}'`,
    );
    assert.equal(advanced.rows[0]?.mileage, 1200);
    await db.exec(`set request.jwt.claim.sub = '${B}';`);
    assert.equal((await db.query('select * from public.vehicles')).rows.length, 0);
    assert.equal((await db.query('select * from public.fuel_entries')).rows.length, 0);
    await assert.rejects(
      db.exec(
        `insert into public.fuel_entries(id,owner_id,vehicle_id,date,odometer,liters,total) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','${B}','${CAR}','2026-10-02',1300,20,900)`,
      ),
    );
    await assert.rejects(
      db.exec(
        `insert into public.vehicles(id,owner_id,make,model,year) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${A}','VW','Golf',2020)`,
      ),
    );
    await db.exec(
      `update public.vehicles set make='Stolen' where id='${CAR}'; delete from public.vehicles where id='${CAR}';`,
    );
    await db.exec(`set request.jwt.claim.sub = '${A}';`);
    assert.equal(
      (await db.query<{ make: string }>('select make from public.vehicles')).rows[0]?.make,
      'BMW',
    );
    await assert.rejects(db.exec(`update public.vehicles set owner_id='${B}' where id='${CAR}'`));
    await assert.rejects(
      db.exec(
        `insert into public.service_entries(id,vehicle_id,date,odometer,title,category,total) values ('ffffffff-ffff-4fff-8fff-ffffffffffff','${CAR}','2026-10-02',1200,'Oil','oil',-1)`,
      ),
    );
    await db.exec(`delete from public.vehicles where id='${CAR}';`);
    assert.equal((await db.query('select * from public.fuel_entries')).rows.length, 0);
  } finally {
    await db.close();
  }
});
