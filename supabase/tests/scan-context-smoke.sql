begin;
insert into auth.users(id,email) values
('92100000-0000-4000-8000-000000000001','mygarage-scan-a@example.invalid'),
('92100000-0000-4000-8000-000000000002','mygarage-scan-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','92100000-0000-4000-8000-000000000001',true);
insert into public.vehicles(id,make,model,year) values ('92200000-0000-4000-8000-000000000001','Scan test','Temporary',2020);
insert into public.diagnostic_scans(id,vehicle_id) values ('92300000-0000-4000-8000-000000000001','92200000-0000-4000-8000-000000000001');
do $$ begin
 if not exists(select 1 from public.diagnostic_scans where id='92300000-0000-4000-8000-000000000001' and context='{}'::jsonb) then raise exception 'FAIL legacy context default'; end if;
 begin
  update public.diagnostic_scans set context='[]'::jsonb where id='92300000-0000-4000-8000-000000000001';
  raise exception 'FAIL array context accepted';
 exception when check_violation then null;
 end;
end $$;
update public.diagnostic_scans set context='{"mode":"all","vin_status":"unavailable","statuses":{"stored":"read","pending":"unavailable","permanent":"read"}}'::jsonb where id='92300000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','92100000-0000-4000-8000-000000000002',true);
do $$ declare affected integer; begin
 if exists(select 1 from public.diagnostic_scans where id='92300000-0000-4000-8000-000000000001') then raise exception 'FAIL foreign context visible'; end if;
 update public.diagnostic_scans set context='{}'::jsonb where id='92300000-0000-4000-8000-000000000001';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'FAIL foreign context modified'; end if;
end $$;
select set_config('request.jwt.claim.sub','92100000-0000-4000-8000-000000000001',true);
do $$ begin
 if not exists(select 1 from public.diagnostic_scans where id='92300000-0000-4000-8000-000000000001' and context->'statuses'->>'pending'='unavailable') then raise exception 'FAIL context lost'; end if;
end $$;
reset role;
rollback;
select 'PASS: scan context, defaults, validation, owner RLS; fixtures rolled back' as result;
