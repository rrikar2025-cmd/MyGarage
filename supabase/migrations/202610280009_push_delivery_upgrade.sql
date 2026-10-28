-- Additive upgrade of already-applied 006; preserve device and delivery records.
begin;
alter table public.push_devices add column session_id uuid references auth.sessions(id) on delete cascade;
alter table public.push_devices drop constraint push_devices_platform_check;
alter table public.push_devices add constraint push_devices_platform_check check(platform in ('ios','android'));
update public.push_devices d set timezone='Europe/Kyiv' where not exists(select 1 from pg_catalog.pg_timezone_names where name=d.timezone);
-- Retire the old registration signature; the new default platform preserves old app calls.
drop function public.register_push_device(text,text,text);
alter table public.service_reminder_deliveries add column revision text not null default '';
alter table public.service_reminder_deliveries add column status text not null default 'accepted' check(status in ('claimed','accepted','delivered','failed','unknown'));
alter table public.service_reminder_deliveries alter column status set default 'claimed';
alter table public.service_reminder_deliveries add column ticket_id text;
alter table public.service_reminder_deliveries add column receipt_checked_at timestamptz;
alter table public.service_reminder_deliveries add column created_at timestamptz not null default now();
-- Existing accepted deliveries must still suppress repeated reminders for the same deadlines.
update public.service_reminder_deliveries d set revision=coalesce(s.next_date::text,'')||':'||coalesce(s.next_odometer::text,''),created_at=d.sent_at from public.service_entries s where s.id=d.service_entry_id;
alter table public.service_reminder_deliveries drop constraint service_reminder_deliveries_pkey;
alter table public.service_reminder_deliveries add primary key(service_entry_id,push_device_id,reminder_state,revision);
grant all on public.push_devices,public.service_reminder_deliveries to service_role;
create function public.register_push_device(p_token text,p_timezone text,p_locale text,p_platform text default 'ios') returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();sid uuid;
begin
 if actor is null then raise exception 'push_registration_requires_auth' using errcode='42501';end if;
 sid:=(auth.jwt()->>'session_id')::uuid;
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=actor) then raise exception 'push_session_invalid' using errcode='42501';end if;
 if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$' or p_locale is null or p_locale not in ('uk','en') or p_platform is null or p_platform not in ('ios','android') or p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'invalid_push_device' using errcode='22023';end if;
 insert into public.push_devices(owner_id,session_id,expo_push_token,platform,timezone,locale) values(actor,sid,p_token,p_platform,p_timezone,p_locale)
 on conflict(expo_push_token) do update set owner_id=excluded.owner_id,session_id=excluded.session_id,platform=excluded.platform,timezone=excluded.timezone,locale=excluded.locale,enabled=true,updated_at=now();
end $$;
revoke all on function public.register_push_device(text,text,text,text),public.set_push_device_enabled(text,boolean) from public,anon;
grant execute on function public.register_push_device(text,text,text,text),public.set_push_device_enabled(text,boolean) to authenticated;
-- Claim before contacting Expo. An uncertain network result is not automatically retried.
create function public.claim_service_reminders(p_limit integer default 100,p_now timestamptz default now()) returns table(service_entry_id uuid,push_device_id uuid,reminder_state text,revision text,expo_push_token text,locale text) language sql security definer set search_path='' as $$
 with latest as (
  select distinct on(s.owner_id,s.vehicle_id,case when s.category='other' then 'other:'||lower(regexp_replace(trim(s.title),'\s+',' ','g')) else s.category end) s.*
  from public.service_entries s order by s.owner_id,s.vehicle_id,case when s.category='other' then 'other:'||lower(regexp_replace(trim(s.title),'\s+',' ','g')) else s.category end,s.date desc,s.odometer desc,s.created_at desc,s.id desc
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
revoke all on function public.claim_service_reminders(integer,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_service_reminders(integer,timestamptz) to service_role;
commit;
