import test from 'node:test';
import { URL } from 'node:url';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const A = '81111111-1111-4111-8111-111111111111',
  B = '82222222-2222-4222-8222-222222222222',
  CAR = '83333333-3333-4333-8333-333333333333',
  OTHER = '84444444-4444-4444-8444-444444444444',
  PLAN = '85555555-5555-4555-8555-555555555555',
  SECOND = '86666666-6666-4666-8666-666666666666';
test('project migration enforces owner scope and atomic installation with retry, deletion and cascade semantics', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${A}'),('${B}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    for (const name of [
      '202610280001_garage',
      '202610280002_logbook_details',
      '202610280004_scan_context',
      '202610280005_projects',
    ])
      await db.exec(
        await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'),
      );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='${B}'; insert into vehicles(id,make,model,year) values('${OTHER}','Other','Car',2020); set request.jwt.claim.sub='${A}'; insert into vehicles(id,make,model,year) values('${CAR}','Owner','Car',2020); insert into build_items(id,vehicle_id,title,category,cost) values('${PLAN}','${CAR}','Brakes','brakes',120),('${SECOND}','${CAR}','Wheels','wheels',300);`,
    );
    const version = String(
      (
        await db.query<{ v: string }>(
          `select updated_at::text v from build_items where id='${PLAN}'`,
        )
      ).rows[0]!.v,
    );
    const payload = {
      name: 'Brakes',
      category: 'brakes',
      cost: 100.25,
      installed_at: '2026-10-28',
      owner_id: B,
      vehicle_id: OTHER,
    };
    const install = (id: string, v: string, obj = payload) =>
      db.query<{
        result: {
          already_installed: boolean;
          mod: { id: string; owner_id: string; vehicle_id: string; cost: number };
          build: { status: string };
        };
      }>('select install_build_item($1,$2,$3::jsonb) result', [id, v, JSON.stringify(obj)]);
    await assert.rejects(install(PLAN, '2000-01-01'));
    await assert.rejects(install(PLAN, version, { ...payload, cost: -1 }));
    assert.equal((await db.query('select * from modifications')).rows.length, 0);
    assert.equal(
      (await db.query<{ status: string }>(`select status from build_items where id='${PLAN}'`))
        .rows[0]!.status,
      'planned',
    );
    const first = (await install(PLAN, version)).rows[0]!.result;
    assert.equal(first.already_installed, false);
    assert.equal(first.mod.id, PLAN);
    assert.equal(first.mod.owner_id, A);
    assert.equal(first.mod.vehicle_id, CAR);
    assert.equal(first.build.status, 'completed');
    const retry = (await install(PLAN, '2000-01-01', { ...payload, cost: 999 })).rows[0]!.result;
    assert.equal(retry.already_installed, true);
    assert.equal(Number(retry.mod.cost), 100.25);
    assert.equal((await db.query('select * from modifications')).rows.length, 1);
    await assert.rejects(db.exec(`update build_items set status='planned' where id='${PLAN}'`));
    await db.exec(`set request.jwt.claim.sub='${B}'`);
    assert.equal((await db.query('select * from modifications')).rows.length, 0);
    assert.equal((await db.query('select * from build_items')).rows.length, 0);
    await assert.rejects(install(PLAN, version));
    await db.exec(
      `update modifications set cost=1 where id='${PLAN}'; delete from build_items where id='${PLAN}'`,
    );
    await assert.rejects(
      db.exec(
        `insert into modifications(id,vehicle_id,name,category,cost,installed_at) values(gen_random_uuid(),'${CAR}','Wrong','other',1,'2026-10-28')`,
      ),
    );
    await assert.rejects(
      db.exec(
        `insert into build_items(id,owner_id,vehicle_id,title,category,cost) values(gen_random_uuid(),'${A}','${CAR}','Wrong','other',1)`,
      ),
    );
    await db.exec(`set request.jwt.claim.sub='${A}'`);
    assert.equal(
      Number((await db.query<{ cost: string }>('select cost from modifications')).rows[0]!.cost),
      100.25,
    );
    await db.exec(`delete from modifications where id='${PLAN}'`);
    await assert.rejects(install(PLAN, version));
    assert.equal((await db.query('select * from modifications')).rows.length, 0);
    const version2 = String(
      (
        await db.query<{ v: string }>(
          `select updated_at::text v from build_items where id='${SECOND}'`,
        )
      ).rows[0]!.v,
    );
    await install(SECOND, version2);
    await db.exec(`delete from build_items where id='${SECOND}'`);
    assert.equal((await db.query('select * from modifications')).rows.length, 1);
    assert.equal(
      (await db.query<{ source_build_id: null }>('select source_build_id from modifications'))
        .rows[0]!.source_build_id,
      null,
    );
    await db.exec('reset role; set role anon;');
    await assert.rejects(install(PLAN, version));
    await assert.rejects(db.exec('select * from modifications'));
    await assert.rejects(db.exec('select * from build_items'));
    await db.exec(
      `reset role; set role authenticated; set request.jwt.claim.sub='${A}'; delete from vehicles where id='${CAR}'`,
    );
    assert.equal((await db.query('select * from modifications')).rows.length, 0);
    assert.equal((await db.query('select * from build_items')).rows.length, 0);
    await db.exec(`set request.jwt.claim.sub='${B}'`);
    assert.equal((await db.query('select * from vehicles')).rows.length, 1);
  } finally {
    await db.close();
  }
});
