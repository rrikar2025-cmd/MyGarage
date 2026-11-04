import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { validInsuranceDate } from '../src/entities/insurance/model/policy';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const CAR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('insurance date accepts actual calendar dates and rejects malformed values', () => {
  assert.equal(validInsuranceDate('2028-02-29'), true);
  assert.equal(validInsuranceDate('2027-02-29'), false);
  assert.equal(validInsuranceDate('2026-13-01'), false);
  assert.equal(validInsuranceDate(''), false);
});

test('insurance is isolated by owner, belongs to the owner vehicle and is deleted with it', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${A}'), ('${B}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth, public to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    for (const file of ['202610280001_garage.sql', '202611040012_insurance.sql'])
      await db.exec(
        await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'),
      );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='${A}'; insert into vehicles(id,make,model,year) values ('${CAR}','VW','Golf',2020); insert into insurance_policies(vehicle_id,provider,policy_number,expires_on) values ('${CAR}','Insurer','123','2027-10-01');`,
    );
    assert.equal((await db.query('select * from insurance_policies')).rows.length, 1);
    await db.exec(`set request.jwt.claim.sub='${B}';`);
    assert.equal((await db.query('select * from insurance_policies')).rows.length, 0);
    assert.equal(
      (await db.query("update insurance_policies set provider='other' returning vehicle_id")).rows
        .length,
      0,
    );
    assert.equal(
      (await db.query('delete from insurance_policies returning vehicle_id')).rows.length,
      0,
    );
    await assert.rejects(
      db.exec(
        `insert into insurance_policies(vehicle_id,owner_id,expires_on) values ('${CAR}','${B}','2027-10-01')`,
      ),
    );
    await db.exec(`set request.jwt.claim.sub='${A}';`);
    assert.equal(
      (await db.query<{ provider: string }>('select provider from insurance_policies')).rows[0]
        ?.provider,
      'Insurer',
    );
    await db.exec(`delete from vehicles where id='${CAR}'`);
    assert.equal((await db.query('select * from insurance_policies')).rows.length, 0);
  } finally {
    await db.close();
  }
});
