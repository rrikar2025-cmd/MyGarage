begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mygarage-private','mygarage-private',false,5242880,array['image/jpeg']);

create table public.media_owner_states(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 deleting boolean not null default false
);
alter table public.media_owner_states enable row level security;
revoke all on public.media_owner_states from public,anon,authenticated;
grant all on public.media_owner_states to service_role;

alter table public.modifications add unique(id,owner_id,vehicle_id);
alter table public.fuel_entries add unique(id,owner_id,vehicle_id);
alter table public.service_entries add unique(id,owner_id,vehicle_id);
create table public.garage_attachments(
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 vehicle_id uuid not null,
 kind text not null check(kind in ('vehicle','mod','build','fuel','service')),
 modification_id uuid, build_id uuid, fuel_id uuid, service_id uuid,
 path text generated always as (owner_id::text||'/'||id::text||'.jpg') stored unique,
 caption text not null default '' check(length(caption)<=160),
 state text not null default 'uploading' check(state in ('uploading','ready')),
 created_at timestamptz not null default now(),
 foreign key(vehicle_id,owner_id) references public.vehicles(id,owner_id) on delete cascade,
 foreign key(modification_id,owner_id,vehicle_id) references public.modifications(id,owner_id,vehicle_id) on delete cascade,
 foreign key(build_id,owner_id,vehicle_id) references public.build_items(id,owner_id,vehicle_id) on delete cascade,
 foreign key(fuel_id,owner_id,vehicle_id) references public.fuel_entries(id,owner_id,vehicle_id) on delete cascade,
 foreign key(service_id,owner_id,vehicle_id) references public.service_entries(id,owner_id,vehicle_id) on delete cascade,
 check((kind='vehicle' and num_nonnulls(modification_id,build_id,fuel_id,service_id)=0)
 or (kind='mod' and modification_id is not null and num_nonnulls(modification_id,build_id,fuel_id,service_id)=1)
 or (kind='build' and build_id is not null and num_nonnulls(modification_id,build_id,fuel_id,service_id)=1)
 or (kind='fuel' and fuel_id is not null and num_nonnulls(modification_id,build_id,fuel_id,service_id)=1)
 or (kind='service' and service_id is not null and num_nonnulls(modification_id,build_id,fuel_id,service_id)=1))
);
create index garage_attachments_owner_vehicle on public.garage_attachments(owner_id,vehicle_id,created_at);
create index garage_attachments_stale on public.garage_attachments(created_at) where state='uploading';
create table public.media_deletion_queue(
 path text primary key,owner_id uuid not null,created_at timestamptz not null default now(),last_checked_at timestamptz
);
alter table public.media_deletion_queue enable row level security;
revoke all on public.media_deletion_queue from public,anon,authenticated;
grant all on public.media_deletion_queue to service_role;

create function public.lock_media_owner() returns trigger language plpgsql security definer set search_path='' as $$
declare blocked boolean; count_target integer;
begin
 insert into public.media_owner_states(owner_id) values(new.owner_id) on conflict do nothing;
 select deleting into blocked from public.media_owner_states where owner_id=new.owner_id for update;
 if blocked then raise exception 'account_removal_in_progress' using errcode='42501';end if;
 select count(*) into count_target from public.garage_attachments a where a.owner_id=new.owner_id and a.kind=new.kind and coalesce(a.modification_id,a.build_id,a.fuel_id,a.service_id,a.vehicle_id)=coalesce(new.modification_id,new.build_id,new.fuel_id,new.service_id,new.vehicle_id);
 if count_target>=10 or (select count(*) from public.garage_attachments where owner_id=new.owner_id)>=200 then raise exception 'attachment_quota_reached' using errcode='54000';end if;
 if new.state<>'uploading' then raise exception 'attachment_requires_upload' using errcode='22023';end if;
 return new;
end $$;
create trigger lock_media_owner before insert on public.garage_attachments for each row execute function public.lock_media_owner();
create function public.queue_media_removal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.media_deletion_queue(path,owner_id) values(old.path,old.owner_id) on conflict do nothing;
 return old;
end $$;
create trigger queue_media_removal after delete on public.garage_attachments for each row execute function public.queue_media_removal();
alter table public.garage_attachments enable row level security;
revoke all on public.garage_attachments from public,anon,authenticated;
grant select,insert,delete on public.garage_attachments to authenticated;
grant all on public.garage_attachments to service_role;
create policy attachment_select on public.garage_attachments for select to authenticated using(owner_id=(select auth.uid()));
create policy attachment_insert on public.garage_attachments for insert to authenticated with check(owner_id=(select auth.uid()));
create policy attachment_delete on public.garage_attachments for delete to authenticated using(owner_id=(select auth.uid()));

-- A row lock serializes uploads with account-removal preparation. No object upserts/updates.
create function public.attachment_upload_allowed(p_path text) returns boolean language plpgsql security definer set search_path='' as $$
declare blocked boolean;
begin
 if auth.uid() is null then return false;end if;
 select deleting into blocked from public.media_owner_states where owner_id=auth.uid() for share;
 if not found or blocked then return false;end if;
 return exists(select 1 from public.garage_attachments where path=p_path and owner_id=auth.uid() and state='uploading');
end $$;
create policy garage_media_read on storage.objects for select to authenticated using(
 bucket_id='mygarage-private' and exists(select 1 from public.garage_attachments a where a.path=name and a.owner_id=(select auth.uid()))
);
create policy garage_media_insert on storage.objects for insert to authenticated with check(
 bucket_id='mygarage-private' and public.attachment_upload_allowed(name)
);
create policy garage_media_delete on storage.objects for delete to authenticated using(
 bucket_id='mygarage-private' and split_part(name,'/',1)=(select auth.uid())::text
);

create function public.finalize_attachment(p_id uuid) returns public.garage_attachments language plpgsql security definer set search_path='' as $$
declare item public.garage_attachments; blocked boolean;
begin
 select deleting into blocked from public.media_owner_states where owner_id=auth.uid() for share;
 if not found or blocked then raise exception 'account_removal_in_progress' using errcode='42501';end if;
 select * into item from public.garage_attachments where id=p_id and owner_id=auth.uid() for update;
 if not found then raise exception 'attachment_not_found' using errcode='42501';end if;
 if not exists(select 1 from storage.objects where bucket_id='mygarage-private' and name=item.path
  and metadata->>'mimetype'='image/jpeg' and (metadata->>'size')::bigint between 1 and 5242880)
 then raise exception 'attachment_upload_incomplete' using errcode='22023';end if;
 update public.garage_attachments set state='ready' where id=item.id returning * into item;
 return item;
end $$;

create function public.prepare_media_account_deletion(p_confirmation text,p_expected_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); claims jsonb:=auth.jwt(); sid uuid;
begin
 if actor is null or p_expected_user is distinct from actor or p_confirmation is distinct from 'DELETE_MY_ACCOUNT' then raise exception 'account_deletion_not_authorized' using errcode='42501';end if;
 begin sid:=(claims->>'session_id')::uuid;exception when invalid_text_representation then raise exception 'account_deletion_not_authorized' using errcode='42501';end;
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=actor)
 or not exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) method where method->>'method'='password' and (method->>'timestamp')::numeric between extract(epoch from now())-300 and extract(epoch from now())+30)
 then raise exception 'fresh_password_authentication_required' using errcode='42501';end if;
 insert into public.media_owner_states(owner_id,deleting) values(actor,true) on conflict(owner_id) do update set deleting=true;
end $$;

-- Keep the original recent-password/session/subject checks and add Storage cleanup preconditions.
create or replace function public.delete_own_account(p_confirmation text,p_expected_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 perform public.prepare_media_account_deletion(p_confirmation,p_expected_user);
 if exists(select 1 from storage.objects where bucket_id='mygarage-private' and split_part(name,'/',1)=actor::text)
 then raise exception 'account_media_cleanup_required' using errcode='55000';end if;
 delete from auth.users where id=actor;
 if not found then raise exception 'account_deletion_not_authorized' using errcode='42501';end if;
end $$;
revoke all on function public.lock_media_owner(),public.queue_media_removal(),public.attachment_upload_allowed(text),public.finalize_attachment(uuid),public.prepare_media_account_deletion(text,uuid) from public,anon;
grant execute on function public.attachment_upload_allowed(text),public.finalize_attachment(uuid),public.prepare_media_account_deletion(text,uuid) to authenticated;
commit;
