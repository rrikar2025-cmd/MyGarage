-- Apply only to the NEW My Garage Supabase project. No Firebase data is changed.
begin;
create table public.vehicles (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  make text not null check (length(trim(make)) between 1 and 60),
  model text not null check (length(trim(model)) between 1 and 60),
  year integer not null check (year between 1886 and 2200),
  mileage integer not null default 0 check (mileage between 0 and 10000000),
  plate text not null default '' check (length(plate) <= 16),
  vin text not null default '' check (vin = '' or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create table public.diagnostic_scans (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id uuid not null,
  stored text[] not null default '{}', pending text[] not null default '{}', permanent text[] not null default '{}',
  metrics jsonb not null default '{}' check (jsonb_typeof(metrics) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, owner_id) references public.vehicles(id, owner_id) on delete cascade
);
create table public.fuel_entries (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id uuid not null,
  date date not null check (date >= '1886-01-01'),
  odometer integer not null check (odometer between 0 and 10000000),
  liters numeric(10,3) not null check (liters > 0 and liters <= 10000),
  total numeric(12,2) not null check (total > 0 and total <= 100000000),
  currency text not null default 'UAH' check (currency = 'UAH'),
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, owner_id) references public.vehicles(id, owner_id) on delete cascade
);
create table public.service_entries (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id uuid not null,
  date date not null check (date >= '1886-01-01'),
  odometer integer not null check (odometer between 0 and 10000000),
  title text not null check (length(trim(title)) between 1 and 120),
  category text not null check (category in ('oil','filters','tires','brakes','other')),
  total numeric(12,2) not null check (total >= 0 and total <= 100000000),
  currency text not null default 'UAH' check (currency = 'UAH'),
  next_odometer integer check (next_odometer > odometer and next_odometer <= 10000000),
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, owner_id) references public.vehicles(id, owner_id) on delete cascade
);
create index vehicles_owner on public.vehicles(owner_id);
create index scans_vehicle_date on public.diagnostic_scans(owner_id, vehicle_id, created_at desc);
create index fuel_vehicle_date on public.fuel_entries(owner_id, vehicle_id, date desc);
create index service_vehicle_date on public.service_entries(owner_id, vehicle_id, date desc);

-- Every operation is isolated by owner, including inserts, updates and child records.
do $$
declare table_name text;
begin
  foreach table_name in array array['vehicles','diagnostic_scans','fuel_entries','service_entries'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', table_name);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', table_name);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)', table_name);
  end loop;
end $$;
create function public.touch_vehicle() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger touch_vehicle before update on public.vehicles for each row execute function public.touch_vehicle();
-- Invoker rights preserve RLS. This and the entry write are one DB transaction.
create function public.advance_vehicle_odometer() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.vehicles set mileage = greatest(mileage, new.odometer)
  where id = new.vehicle_id and owner_id = new.owner_id and mileage < new.odometer;
  return new;
end $$;
create trigger fuel_odometer after insert or update on public.fuel_entries for each row execute function public.advance_vehicle_odometer();
create trigger service_odometer after insert or update on public.service_entries for each row execute function public.advance_vehicle_odometer();
commit;
