begin;
create table public.insurance_policies (
  vehicle_id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null default '' check (char_length(provider) <= 100),
  policy_number text not null default '' check (char_length(policy_number) <= 100),
  expires_on date not null check (expires_on between '1900-01-01' and '2200-12-31'),
  foreign key (vehicle_id, owner_id) references public.vehicles(id, owner_id) on delete cascade
);
alter table public.insurance_policies enable row level security;
revoke all on public.insurance_policies from public, anon;
grant select, insert, update, delete on public.insurance_policies to authenticated;
create policy insurance_select on public.insurance_policies for select to authenticated using ((select auth.uid()) = owner_id);
create policy insurance_insert on public.insurance_policies for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy insurance_update on public.insurance_policies for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy insurance_delete on public.insurance_policies for delete to authenticated using ((select auth.uid()) = owner_id);
commit;
