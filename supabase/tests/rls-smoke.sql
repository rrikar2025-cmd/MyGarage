-- Isolated verification. All test users and rows are rolled back in this transaction.
begin;
insert into auth.users(id,email) values
('90100000-0000-4000-8000-000000000001','mygarage-rls-a@example.invalid'),
('90100000-0000-4000-8000-000000000002','mygarage-rls-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','90100000-0000-4000-8000-000000000001',true);
insert into public.vehicles(id,make,model,year,mileage) values ('90200000-0000-4000-8000-000000000001','RLS test','Temporary',2020,1000);
insert into public.fuel_entries(id,vehicle_id,date,odometer,liters,total,fuel_type,full_tank)
values ('90300000-0000-4000-8000-000000000001','90200000-0000-4000-8000-000000000001','2026-10-01',1200,30,1500,'petrol',true);
do $$ begin
  if not exists(select 1 from public.vehicles where id='90200000-0000-4000-8000-000000000001' and mileage=1200) then raise exception 'FAIL owner access / odometer'; end if;
  if not exists(select 1 from public.fuel_entries where id='90300000-0000-4000-8000-000000000001' and full_tank=true) then raise exception 'FAIL fuel details'; end if;
end $$;
select set_config('request.jwt.claim.sub','90100000-0000-4000-8000-000000000002',true);
do $$ declare affected integer; begin
  if exists(select 1 from public.vehicles where id='90200000-0000-4000-8000-000000000001') then raise exception 'FAIL foreign car visible'; end if;
  if exists(select 1 from public.fuel_entries where id='90300000-0000-4000-8000-000000000001') then raise exception 'FAIL foreign fuel visible'; end if;
  update public.vehicles set make='blocked change' where id='90200000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL foreign update'; end if;
  begin
    insert into public.fuel_entries(id,vehicle_id,date,odometer,liters,total) values ('90300000-0000-4000-8000-000000000002','90200000-0000-4000-8000-000000000001','2026-10-02',1300,10,500);
    raise exception 'FAIL foreign parent accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.vehicles(id,owner_id,make,model,year) values ('90200000-0000-4000-8000-000000000002','90100000-0000-4000-8000-000000000001','blocked','owner spoof',2020);
    raise exception 'FAIL owner spoof accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'PASS: owner isolation, parent ownership, odometer and fuel fields; all test records rolled back' as result;
