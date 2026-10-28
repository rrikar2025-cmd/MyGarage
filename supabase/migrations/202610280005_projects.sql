-- Actual date limits include the UTC boundary day; UI uses the local calendar.
begin;
alter table public.vehicles add column build_budget numeric(12,2) check(build_budget between 0 and 100000000);
create table public.build_items (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 vehicle_id uuid not null,
 title text not null check(length(trim(title)) between 1 and 120),
 category text not null check(category in ('engine','exhaust','suspension','electronics','brakes','wheels','interior','exterior','other')),
 priority text not null default 'medium' check(priority in ('low','medium','high')),
 status text not null default 'planned' check(status in ('planned','in_progress','completed')),
 cost numeric(12,2) not null check(cost between 0 and 100000000),
 currency text not null default 'UAH' check(currency='UAH'),
 planned_date date check(planned_date between '1886-01-01' and '2200-12-31'),
 completed_at date check(completed_at between '1886-01-01' and current_date + 1),
 product_link text not null default '' check(length(product_link)<=2000 and (product_link='' or product_link ~ '^https?://[^/?#@[:space:]]+([/?#]|$)')),
 notes text not null default '' check(length(notes)<=2000),
 converted_mod_id uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((status='completed')=(completed_at is not null)),
 check(converted_mod_id is null or status='completed'),
 unique(id,owner_id,vehicle_id),
 foreign key(vehicle_id,owner_id) references public.vehicles(id,owner_id) on delete cascade
);
create table public.modifications (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 vehicle_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 120),
 description text not null default '' check(length(description)<=1000),
 category text not null check(category in ('engine','exhaust','suspension','electronics','brakes','wheels','interior','exterior','other')),
 cost numeric(12,2) not null check(cost between 0 and 100000000),
 currency text not null default 'UAH' check(currency='UAH'),
 year integer check(year between 1886 and extract(year from current_date) + 1),
 installed_at date not null check(installed_at between '1886-01-01' and current_date + 1),
 supplier text not null default '' check(length(supplier)<=120),
 product_link text not null default '' check(length(product_link)<=2000 and (product_link='' or product_link ~ '^https?://[^/?#@[:space:]]+([/?#]|$)')),
 notes text not null default '' check(length(notes)<=2000),
 source_build_id uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(owner_id,source_build_id),
 foreign key(vehicle_id,owner_id) references public.vehicles(id,owner_id) on delete cascade,
 foreign key(source_build_id,owner_id,vehicle_id) references public.build_items(id,owner_id,vehicle_id) on delete set null (source_build_id)
);
create index modifications_owner_vehicle on public.modifications(owner_id,vehicle_id,installed_at desc);
create index build_items_owner_vehicle on public.build_items(owner_id,vehicle_id,status);
create trigger touch_build_item before update on public.build_items for each row execute function public.touch_vehicle();
create trigger touch_modification before update on public.modifications for each row execute function public.touch_vehicle();
do $$ declare table_name text; begin
 foreach table_name in array array['modifications','build_items'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('revoke all on public.%I from anon',table_name);
  execute format('grant select,insert,update,delete on public.%I to authenticated',table_name);
  execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid())=owner_id)',table_name);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid())=owner_id)',table_name);
  execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id)',table_name);
  execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid())=owner_id)',table_name);
 end loop;
end $$;
-- Invoker rights preserve the same owner RLS and table privileges as ordinary CRUD.
-- Locking + stable mod UUID makes retries atomic and idempotent without deleting the plan.
create function public.install_build_item(p_build_id uuid,p_expected_updated_at timestamptz,p_mod jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare plan public.build_items%rowtype; installed public.modifications%rowtype; actor uuid:=auth.uid();
begin
 if actor is null or jsonb_typeof(p_mod) is distinct from 'object' then raise exception 'project_not_authorized' using errcode='42501'; end if;
 select * into plan from public.build_items where id=p_build_id and owner_id=actor for update;
 if not found then raise exception 'build_not_found' using errcode='P0001'; end if;
 if plan.converted_mod_id is not null then
  select * into installed from public.modifications where id=plan.converted_mod_id and owner_id=actor and vehicle_id=plan.vehicle_id and source_build_id=plan.id;
  if not found then raise exception 'installed_modification_removed' using errcode='P0001'; end if;
  return jsonb_build_object('build',to_jsonb(plan),'mod',to_jsonb(installed),'already_installed',true);
 end if;
 if plan.updated_at is distinct from p_expected_updated_at then raise exception 'build_changed' using errcode='40001'; end if;
 insert into public.modifications(id,owner_id,vehicle_id,name,description,category,cost,currency,year,installed_at,supplier,product_link,notes,source_build_id)
 values(plan.id,actor,plan.vehicle_id,p_mod->>'name',coalesce(p_mod->>'description',''),p_mod->>'category',(p_mod->>'cost')::numeric,'UAH',nullif(p_mod->>'year','')::integer,(p_mod->>'installed_at')::date,coalesce(p_mod->>'supplier',''),coalesce(p_mod->>'product_link',''),coalesce(p_mod->>'notes',''),plan.id)
 returning * into installed;
 update public.build_items set status='completed',completed_at=installed.installed_at,converted_mod_id=installed.id where id=plan.id and owner_id=actor returning * into plan;
 return jsonb_build_object('build',to_jsonb(plan),'mod',to_jsonb(installed),'already_installed',false);
end $$;
revoke all on function public.install_build_item(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.install_build_item(uuid,timestamptz,jsonb) to authenticated;
commit;
