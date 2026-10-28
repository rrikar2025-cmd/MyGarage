begin;

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null check (length(expo_push_token) between 20 and 512),
  platform text not null check (platform = 'ios'),
  timezone text not null default 'Europe/Kyiv' check (length(timezone) between 1 and 80),
  locale text not null default 'uk' check (locale in ('uk', 'en')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expo_push_token)
);

create index push_devices_owner on public.push_devices(owner_id);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon;
grant select on public.push_devices to authenticated;
create policy push_devices_owner_select on public.push_devices
  for select to authenticated using ((select auth.uid()) = owner_id);
grant select, update on public.push_devices to service_role;

create function public.register_push_device(p_token text, p_timezone text, p_locale text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'push_registration_requires_auth' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 512
    or right(p_token, 1) <> ']'
    or not (
      left(p_token, length('ExponentPushToken[')) = 'ExponentPushToken['
      or left(p_token, length('ExpoPushToken[')) = 'ExpoPushToken['
    ) then
    raise exception 'invalid_expo_push_token' using errcode = '22023';
  end if;
  if p_locale is null or p_locale not in ('uk', 'en') then
    raise exception 'invalid_push_locale' using errcode = '22023';
  end if;

  insert into public.push_devices(owner_id, expo_push_token, platform, timezone, locale)
  values (actor, p_token, 'ios', coalesce(nullif(left(p_timezone, 80), ''), 'Europe/Kyiv'), p_locale)
  on conflict (expo_push_token) do update set
    owner_id = excluded.owner_id,
    timezone = excluded.timezone,
    locale = excluded.locale,
    enabled = true,
    updated_at = now();
end;
$$;

revoke all on function public.register_push_device(text, text, text) from public, anon;
grant execute on function public.register_push_device(text, text, text) to authenticated;

create function public.set_push_device_enabled(p_token text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or p_enabled is null then
    raise exception 'push_device_update_requires_auth' using errcode = '42501';
  end if;
  update public.push_devices
  set enabled = p_enabled, updated_at = now()
  where owner_id = actor and expo_push_token = p_token;
end;
$$;

revoke all on function public.set_push_device_enabled(text, boolean) from public, anon;
grant execute on function public.set_push_device_enabled(text, boolean) to authenticated;

create table public.service_reminder_deliveries (
  service_entry_id uuid not null references public.service_entries(id) on delete cascade,
  push_device_id uuid not null references public.push_devices(id) on delete cascade,
  reminder_state text not null check (reminder_state in ('soon', 'overdue')),
  sent_at timestamptz not null default now(),
  primary key (service_entry_id, push_device_id, reminder_state)
);

alter table public.service_reminder_deliveries enable row level security;
revoke all on public.service_reminder_deliveries from public, anon, authenticated;
grant select, insert on public.service_reminder_deliveries to service_role;

commit;
