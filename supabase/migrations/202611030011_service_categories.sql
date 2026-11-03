begin;
alter table public.service_entries add column categories text[];
alter table public.service_entries add column categories_version smallint;
create function public.sync_service_categories() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op = 'UPDATE' and new.categories_version is null then
  if new.category is not distinct from old.category then new.categories := coalesce(old.categories, array[old.category]);
  else new.categories := array[new.category]; end if;
 elsif tg_op = 'UPDATE' and new.category is distinct from old.category and new.categories is not distinct from old.categories then new.categories := array[new.category];
 elsif new.categories is null then new.categories := array[new.category];
 end if;
 return new;
end $$;
create trigger sync_service_categories before insert or update on public.service_entries for each row execute function public.sync_service_categories();
alter table public.service_entries add constraint service_categories_valid check (
 categories is null or (
 cardinality(categories) between 1 and 5 and categories[1] = category
 and categories <@ array['oil','filters','tires','brakes','other']::text[]
 and array_position(categories, null) is null
 and cardinality(array_positions(categories, 'oil')) <= 1
 and cardinality(array_positions(categories, 'filters')) <= 1
 and cardinality(array_positions(categories, 'tires')) <= 1
 and cardinality(array_positions(categories, 'brakes')) <= 1
 and cardinality(array_positions(categories, 'other')) <= 1)
);
create or replace function public.claim_service_reminders(p_limit integer default 100,p_now timestamptz default now()) returns table(service_entry_id uuid,push_device_id uuid,reminder_state text,revision text,expo_push_token text,locale text) language sql security definer set search_path='' as $$
 with latest_categories as (
  select distinct on(s.owner_id,s.vehicle_id,case when c.category='other' then 'other:'||lower(regexp_replace(trim(s.title),'\s+',' ','g')) else c.category end) s.id
  from public.service_entries s cross join lateral unnest(coalesce(s.categories, array[s.category])) as c(category)
  order by s.owner_id,s.vehicle_id,case when c.category='other' then 'other:'||lower(regexp_replace(trim(s.title),'\s+',' ','g')) else c.category end,s.date desc,s.odometer desc,s.created_at desc,s.id desc
 ), latest as (
  select s.* from public.service_entries s where s.id in (select id from latest_categories)
 ), candidates as (
  select s.id service_entry_id,d.id push_device_id,
   case when s.next_odometer<=v.mileage or s.next_date<=(p_now at time zone d.timezone)::date then 'overdue' else 'soon' end reminder_state,
   coalesce(s.next_date::text,'')||':'||coalesce(s.next_odometer::text,'') revision,d.expo_push_token,d.locale
  from latest s join public.vehicles v on v.id=s.vehicle_id and v.owner_id=s.owner_id
  join public.push_devices d on d.owner_id=s.owner_id and d.enabled and d.session_id is not null
  where extract(hour from p_now at time zone d.timezone)=9
   and (s.next_odometer-v.mileage<=500 or s.next_date<=(p_now at time zone d.timezone)::date+30)
 ), claimed as (
  insert into public.service_reminder_deliveries(service_entry_id,push_device_id,reminder_state,revision)
  select c.service_entry_id,c.push_device_id,c.reminder_state,c.revision from candidates c
  where not exists(select 1 from public.service_reminder_deliveries x where x.service_entry_id=c.service_entry_id and x.push_device_id=c.push_device_id and x.reminder_state=c.reminder_state and x.revision=c.revision)
  order by c.service_entry_id,c.push_device_id limit greatest(1,least(p_limit,100)) on conflict do nothing
  returning service_entry_id,push_device_id,reminder_state,revision
 ) select c.* from candidates c join claimed x using(service_entry_id,push_device_id,reminder_state,revision);
$$;
commit;
