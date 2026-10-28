begin;
-- Additive migration: legacy rows remain valid and are never assumed to be full-tank fills.
alter table public.fuel_entries
  add column fuel_type text check (fuel_type is null or fuel_type in ('petrol','diesel','lpg','other')),
  add column full_tank boolean not null default false;
alter table public.service_entries add column next_date date;
alter table public.service_entries add constraint valid_next_service_date check (next_date is null or (next_date > date and next_date <= '2200-12-31'));
-- Owner policies and composite foreign keys from migration 001 still apply to all columns.
commit;
