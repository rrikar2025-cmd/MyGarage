-- All identities and financial rows below are isolated fixtures, rolled back together.
begin;
insert into auth.users(id,email) values
('93100000-0000-4000-8000-000000000001','mygarage-project-a@example.invalid'),
('93100000-0000-4000-8000-000000000002','mygarage-project-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','93100000-0000-4000-8000-000000000001',true);
insert into public.vehicles(id,make,model,year,build_budget) values ('93200000-0000-4000-8000-000000000001','Project fixture','Temporary',2020,200);
insert into public.build_items(id,vehicle_id,title,category,cost) values
('93300000-0000-4000-8000-000000000001','93200000-0000-4000-8000-000000000001','Fixture brakes','brakes',120),
('93300000-0000-4000-8000-000000000002','93200000-0000-4000-8000-000000000001','Fixture wheels','wheels',80);
do $$ declare receipt jsonb; version timestamptz; begin
 select updated_at into version from public.build_items where id='93300000-0000-4000-8000-000000000001';
 begin
  perform public.install_build_item('93300000-0000-4000-8000-000000000001','2000-01-01','{"name":"Fixture","category":"brakes","cost":100.25,"installed_at":"2026-10-28"}');
  raise exception 'FAIL stale version accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.install_build_item('93300000-0000-4000-8000-000000000001',version,'{"name":"Fixture","category":"brakes","cost":-1,"installed_at":"2026-10-28"}');
  raise exception 'FAIL negative cost accepted';
 exception when check_violation then null; end;
 if exists(select 1 from public.modifications) or not exists(select 1 from public.build_items where status='planned') then raise exception 'FAIL partial write'; end if;
 receipt:=public.install_build_item('93300000-0000-4000-8000-000000000001',version,'{"name":"Fixture","category":"brakes","cost":100.25,"installed_at":"2026-10-28","owner_id":"93100000-0000-4000-8000-000000000002"}');
 if (receipt->>'already_installed')::boolean or receipt->'mod'->>'owner_id'<>'93100000-0000-4000-8000-000000000001' then raise exception 'FAIL install owner'; end if;
 receipt:=public.install_build_item('93300000-0000-4000-8000-000000000001',version,'{"name":"Retry","cost":999}');
 if not (receipt->>'already_installed')::boolean or (receipt->'mod'->>'cost')::numeric<>100.25 or (select count(*) from public.modifications)<>1 then raise exception 'FAIL duplicate retry'; end if;
end $$;
select set_config('request.jwt.claim.sub','93100000-0000-4000-8000-000000000002',true);
do $$ declare affected integer; begin
 if exists(select 1 from public.modifications) or exists(select 1 from public.build_items) then raise exception 'FAIL foreign rows visible'; end if;
 update public.modifications set cost=1 where id='93300000-0000-4000-8000-000000000001'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL foreign update'; end if;
 begin
  perform public.install_build_item('93300000-0000-4000-8000-000000000001',now(),'{}');
  raise exception 'FAIL foreign install';
 exception when raise_exception then if sqlerrm<>'build_not_found' then raise; end if; end;
 begin
  insert into public.build_items(id,vehicle_id,title,category,cost) values(gen_random_uuid(),'93200000-0000-4000-8000-000000000001','Blocked','other',1);
  raise exception 'FAIL foreign parent';
 exception when foreign_key_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','93100000-0000-4000-8000-000000000001',true);
delete from public.modifications where id='93300000-0000-4000-8000-000000000001';
do $$ begin
 begin
  perform public.install_build_item('93300000-0000-4000-8000-000000000001',now(),'{}');
  raise exception 'FAIL removed expense resurrected';
 exception when raise_exception then if sqlerrm<>'installed_modification_removed' then raise; end if; end;
 perform public.install_build_item('93300000-0000-4000-8000-000000000002',(select updated_at from public.build_items where id='93300000-0000-4000-8000-000000000002'),'{"name":"Fixture wheels","category":"wheels","cost":80,"installed_at":"2026-10-28"}');
end $$;
delete from public.build_items where id='93300000-0000-4000-8000-000000000002';
do $$ begin
 if not exists(select 1 from public.modifications where source_build_id is null and cost=80) then raise exception 'FAIL plan deletion lost installed expense'; end if;
end $$;
delete from public.vehicles where id='93200000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.modifications) or exists(select 1 from public.build_items) then raise exception 'FAIL vehicle cascade'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.install_build_item('93300000-0000-4000-8000-000000000001',now(),'{}');raise exception 'FAIL anon RPC';exception when insufficient_privilege then null;end;
 begin perform * from public.modifications;raise exception 'FAIL anon table';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: projects owner RLS, atomic install, retry, deletion links, cascades; all fixtures rolled back' as result;
