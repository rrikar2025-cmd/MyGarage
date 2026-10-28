-- All fixture accounts, sessions and removals are inside a transaction that is rolled back.
begin;
insert into auth.users(id,email) values
('91100000-0000-4000-8000-000000000001','mygarage-delete-a@example.invalid'),
('91100000-0000-4000-8000-000000000002','mygarage-delete-b@example.invalid');
insert into auth.sessions(id,user_id) values ('91200000-0000-4000-8000-000000000001','91100000-0000-4000-8000-000000000001');
insert into public.vehicles(id,owner_id,make,model,year) values
('91300000-0000-4000-8000-000000000001','91100000-0000-4000-8000-000000000001','Deletion test','Temporary A',2020),
('91300000-0000-4000-8000-000000000002','91100000-0000-4000-8000-000000000002','Deletion test','Temporary B',2020);
insert into public.fuel_entries(id,owner_id,vehicle_id,date,odometer,liters,total) values
('91400000-0000-4000-8000-000000000001','91100000-0000-4000-8000-000000000001','91300000-0000-4000-8000-000000000001','2026-10-01',1000,10,500);
insert into public.service_entries(id,owner_id,vehicle_id,date,odometer,title,category,total) values
('91500000-0000-4000-8000-000000000001','91100000-0000-4000-8000-000000000001','91300000-0000-4000-8000-000000000001','2026-10-01',1000,'Oil','oil',500);
insert into public.diagnostic_scans(id,owner_id,vehicle_id) values
('91600000-0000-4000-8000-000000000001','91100000-0000-4000-8000-000000000001','91300000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','91100000-0000-4000-8000-000000000001','role','authenticated','session_id','91200000-0000-4000-8000-000000000001','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now()))))::text,true);
do $$ begin
  begin
    perform public.delete_own_account('DELETE_MY_ACCOUNT','91100000-0000-4000-8000-000000000002');
    raise exception 'FAIL account switch accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_own_account('WRONG','91100000-0000-4000-8000-000000000001');
    raise exception 'FAIL wrong confirmation accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub','91100000-0000-4000-8000-000000000002','role','authenticated','session_id','91200000-0000-4000-8000-000000000001','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now()))))::text,true);
do $$ begin
  begin
    perform public.delete_own_account('DELETE_MY_ACCOUNT','91100000-0000-4000-8000-000000000001');
    raise exception 'FAIL foreign session accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub','91100000-0000-4000-8000-000000000001','role','authenticated','session_id','91200000-0000-4000-8000-000000000001','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())-301)))::text,true);
do $$ begin
  begin
    perform public.delete_own_account('DELETE_MY_ACCOUNT','91100000-0000-4000-8000-000000000001');
    raise exception 'FAIL stale password accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub','91100000-0000-4000-8000-000000000001','role','authenticated','session_id','91200000-0000-4000-8000-000000000001','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now()))))::text,true);
select public.delete_own_account('DELETE_MY_ACCOUNT','91100000-0000-4000-8000-000000000001');
reset role;
do $$ begin
  if exists(select 1 from auth.users where id='91100000-0000-4000-8000-000000000001') then raise exception 'FAIL account remains'; end if;
  if exists(select 1 from auth.sessions where id='91200000-0000-4000-8000-000000000001') then raise exception 'FAIL session remains'; end if;
  if exists(select 1 from public.vehicles where id='91300000-0000-4000-8000-000000000001') then raise exception 'FAIL vehicle remains'; end if;
  if exists(select 1 from public.fuel_entries where id='91400000-0000-4000-8000-000000000001') then raise exception 'FAIL fuel remains'; end if;
  if exists(select 1 from public.service_entries where id='91500000-0000-4000-8000-000000000001') then raise exception 'FAIL service remains'; end if;
  if exists(select 1 from public.diagnostic_scans where id='91600000-0000-4000-8000-000000000001') then raise exception 'FAIL scan remains'; end if;
  if not exists(select 1 from auth.users where id='91100000-0000-4000-8000-000000000002') or not exists(select 1 from public.vehicles where id='91300000-0000-4000-8000-000000000002') then raise exception 'FAIL foreign data changed'; end if;
  if has_function_privilege('anon','public.delete_own_account(text,uuid)','EXECUTE') then raise exception 'FAIL anonymous execute'; end if;
end $$;
rollback;
select 'PASS: deletion guards, own-data cascade, foreign data preserved; all fixtures rolled back' as result;
