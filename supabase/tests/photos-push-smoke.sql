-- Isolated database fixtures only. No files, real accounts or notifications are sent/removed.
begin;
insert into auth.users(id,email) values
('94100000-0000-4000-8000-000000000001','mygarage-media-a@example.invalid'),
('94100000-0000-4000-8000-000000000002','mygarage-media-b@example.invalid');
insert into auth.sessions(id,user_id) values
('94200000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001'),
('94200000-0000-4000-8000-000000000002','94100000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','94100000-0000-4000-8000-000000000001','role','authenticated','session_id','94200000-0000-4000-8000-000000000001','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now()))))::text,true);
insert into public.vehicles(id,make,model,year,mileage) values('94300000-0000-4000-8000-000000000001','Media fixture','Temporary A',2020,1000);
insert into public.garage_attachments(id,vehicle_id,kind) values('94400000-0000-4000-8000-000000000001','94300000-0000-4000-8000-000000000001','vehicle');
select public.register_push_device('ExpoPushToken[fixtureaaaaaaaaaaaa]','Europe/Kyiv','uk','ios');
insert into public.service_entries(id,vehicle_id,date,odometer,title,category,total,next_date)
values('94500000-0000-4000-8000-000000000001','94300000-0000-4000-8000-000000000001','2026-10-01',1000,'Fixture filters','filters',1,'2026-11-01');
do $$ begin
 begin perform public.finalize_attachment('94400000-0000-4000-8000-000000000001');raise exception 'FAIL missing upload accepted';exception when invalid_parameter_value then null;end;
 begin perform * from public.claim_service_reminders();raise exception 'FAIL user claimed server work';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub','94100000-0000-4000-8000-000000000002','role','authenticated','session_id','94200000-0000-4000-8000-000000000002')::text,true);
do $$ begin
 if exists(select 1 from public.garage_attachments where id='94400000-0000-4000-8000-000000000001') then raise exception 'FAIL foreign photo visible';end if;
 if exists(select 1 from public.push_devices where expo_push_token='ExpoPushToken[fixtureaaaaaaaaaaaa]') then raise exception 'FAIL foreign device visible';end if;
 begin insert into public.garage_attachments(id,vehicle_id,kind) values(gen_random_uuid(),'94300000-0000-4000-8000-000000000001','vehicle');raise exception 'FAIL foreign parent accepted';exception when foreign_key_violation then null;end;
 begin insert into public.garage_attachments(id,owner_id,vehicle_id,kind) values(gen_random_uuid(),'94100000-0000-4000-8000-000000000001','94300000-0000-4000-8000-000000000001','vehicle');raise exception 'FAIL owner spoof';exception when insufficient_privilege then null;end;
end $$;
select public.set_push_device_enabled('ExpoPushToken[fixtureaaaaaaaaaaaa]',false);
reset role;
set local role service_role;
do $$ declare first_count integer; repeat_count integer; begin
 if exists(select 1 from public.push_devices where enabled and owner_id<>'94100000-0000-4000-8000-000000000001') then raise exception 'Fixture-only claim test requires no other enabled devices';end if;
 select count(*) into first_count from public.claim_service_reminders(100,'2026-10-28T07:00:00Z');
 select count(*) into repeat_count from public.claim_service_reminders(100,'2026-10-28T07:15:00Z');
 if first_count<>1 or repeat_count<>0 then raise exception 'FAIL push claim/idempotence %, %',first_count,repeat_count;end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','94100000-0000-4000-8000-000000000001','role','authenticated','session_id','94200000-0000-4000-8000-000000000001','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now()))))::text,true);
select public.prepare_media_account_deletion('DELETE_MY_ACCOUNT','94100000-0000-4000-8000-000000000001');
do $$ begin
 begin insert into public.garage_attachments(id,vehicle_id,kind) values(gen_random_uuid(),'94300000-0000-4000-8000-000000000001','vehicle');raise exception 'FAIL upload during account removal';exception when insufficient_privilege then null;end;
end $$;
select public.delete_own_account('DELETE_MY_ACCOUNT','94100000-0000-4000-8000-000000000001');
reset role;
do $$ begin
 if not exists(select 1 from public.media_deletion_queue where path='94100000-0000-4000-8000-000000000001/94400000-0000-4000-8000-000000000001.jpg') then raise exception 'FAIL cleanup not queued';end if;
 if exists(select 1 from public.garage_attachments where owner_id='94100000-0000-4000-8000-000000000001') then raise exception 'FAIL photo metadata cascade';end if;
 if not exists(select 1 from auth.users where id='94100000-0000-4000-8000-000000000002') then raise exception 'FAIL other owner deleted';end if;
 if (select public from storage.buckets where id='mygarage-private') is distinct from false then raise exception 'FAIL bucket public';end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.garage_attachments;raise exception 'FAIL anon photos';exception when insufficient_privilege then null;end;
 begin perform * from public.garage_job_settings;raise exception 'FAIL scheduler key exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: private photo metadata, owner isolation, upload/account fencing, cleanup queue, session-bound push and one-time claims; fixtures rolled back; no files or pushes sent' as result;
