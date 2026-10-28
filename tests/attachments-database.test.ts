import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
const A = 'a1111111-1111-4111-8111-111111111111',
  B = 'b1111111-1111-4111-8111-111111111111',
  CAR = 'c1111111-1111-4111-8111-111111111111',
  OTHER = 'd1111111-1111-4111-8111-111111111111',
  PHOTO = 'e1111111-1111-4111-8111-111111111111',
  SESSION = 'f1111111-1111-4111-8111-111111111111';
test('private media schema enforces parent ownership, immutable paths, upload completion, deletion queue and account fencing', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade);create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.jwt(),auth.uid() to authenticated;insert into auth.users values('${A}'),('${B}');insert into auth.sessions values('${SESSION}','${A}');create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb default '{}');alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`,
    );
    for (const name of [
      '202610280001_garage',
      '202610280002_logbook_details',
      '202610280003_account_deletion',
      '202610280004_scan_context',
      '202610280005_projects',
      '202610280007_private_attachments',
      '202610280010_media_guard',
    ])
      await db.exec(
        await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'),
      );
    async function claims(sub: string, age = 0) {
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({
          sub,
          session_id: SESSION,
          amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - age }],
        }),
      ]);
    }
    await db.exec(`set role authenticated`);
    await claims(B);
    await db.exec(`insert into vehicles(id,make,model,year) values('${OTHER}','Other','Car',2020)`);
    await claims(A);
    await db.exec(
      `insert into vehicles(id,make,model,year) values('${CAR}','Own','Car',2020);insert into garage_attachments(id,vehicle_id,kind) values('${PHOTO}','${CAR}','vehicle')`,
    );
    const path = `${A}/${PHOTO}.jpg`;
    await assert.rejects(db.exec(`select finalize_attachment('${PHOTO}')`));
    await assert.rejects(
      db.exec(
        `insert into storage.objects(bucket_id,name) values('mygarage-private','${A}/not-reserved.jpg')`,
      ),
    );
    await db.exec(
      `insert into storage.objects(bucket_id,name,metadata) values('mygarage-private','${path}','{"size":100,"mimetype":"image/jpeg"}')`,
    );
    await db.exec(`select finalize_attachment('${PHOTO}');select finalize_attachment('${PHOTO}')`);
    assert.equal(
      (await db.query<{ state: string }>('select state from garage_attachments')).rows[0]!.state,
      'ready',
    );
    await assert.rejects(db.exec(`update garage_attachments set caption='direct edit'`));
    await db.exec(`update storage.objects set name='${B}/${PHOTO}.jpg'`);
    assert.equal(
      (await db.query<{ name: string }>('select name from storage.objects')).rows[0]!.name,
      path,
    );
    await claims(B);
    assert.equal((await db.query('select * from garage_attachments')).rows.length, 0);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    await assert.rejects(db.exec(`select finalize_attachment('${PHOTO}')`));
    await assert.rejects(
      db.exec(
        `insert into garage_attachments(id,vehicle_id,kind) values(gen_random_uuid(),'${CAR}','vehicle')`,
      ),
    );
    await db.exec(`delete from storage.objects where name='${path}'`);
    await claims(A);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    await db.exec(
      `insert into service_entries(id,vehicle_id,date,odometer,title,category,total) values('${OTHER}','${CAR}','2026-10-28',0,'Service','other',0)`,
    );
    await claims(B);
    await assert.rejects(
      db.exec(
        `insert into garage_attachments(id,vehicle_id,kind,service_id) values(gen_random_uuid(),'${OTHER}','service','${OTHER}')`,
      ),
    );
    await claims(A);
    await db.exec(
      `insert into garage_attachments(id,vehicle_id,kind,service_id) values('${SESSION}','${CAR}','service','${OTHER}');delete from service_entries where id='${OTHER}'`,
    );
    assert.equal((await db.query('select * from garage_attachments')).rows.length, 1);
    await assert.rejects(db.exec('select * from media_deletion_queue'));
    await claims(A, 301);
    await assert.rejects(
      db.exec(`select prepare_media_account_deletion('DELETE_MY_ACCOUNT','${A}')`),
    );
    await claims(A);
    await assert.rejects(
      db.exec(`select prepare_media_account_deletion('DELETE_MY_ACCOUNT','${B}')`),
    );
    await db.exec(`select prepare_media_account_deletion('DELETE_MY_ACCOUNT','${A}')`);
    await assert.rejects(
      db.exec(
        `insert into garage_attachments(id,vehicle_id,kind) values(gen_random_uuid(),'${CAR}','vehicle')`,
      ),
    );
    await assert.rejects(db.exec(`select delete_own_account('DELETE_MY_ACCOUNT','${A}')`));
    await db.exec('reset role');
    assert.equal((await db.query('select * from media_deletion_queue')).rows.length, 1);
    await db.exec(
      `delete from storage.objects where bucket_id='mygarage-private' and name='${path}';set role authenticated;select delete_own_account('DELETE_MY_ACCOUNT','${A}')`,
    );
    await db.exec('reset role');
    assert.equal((await db.query('select * from auth.users')).rows.length, 1);
    assert.equal((await db.query('select * from media_deletion_queue')).rows.length, 2);
    assert.equal(
      (await db.query<{ public: boolean }>('select public from storage.buckets')).rows[0]?.public,
      false,
    );
    await db.exec('set role anon');
    await assert.rejects(db.exec('select * from garage_attachments'));
    await assert.rejects(db.exec(`select finalize_attachment('${PHOTO}')`));
  } finally {
    await db.close();
  }
});
