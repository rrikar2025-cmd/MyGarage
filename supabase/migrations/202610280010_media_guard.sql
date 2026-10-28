begin;
create or replace function public.lock_media_owner() returns trigger language plpgsql security definer set search_path='' as $$
declare blocked boolean; count_target integer;
begin
 if new.owner_id is distinct from auth.uid() then raise exception 'attachment_owner_mismatch' using errcode='42501';end if;
 insert into public.media_owner_states(owner_id) values(new.owner_id) on conflict do nothing;
 select deleting into blocked from public.media_owner_states where owner_id=new.owner_id for update;
 if blocked then raise exception 'account_removal_in_progress' using errcode='42501';end if;
 select count(*) into count_target from public.garage_attachments a where a.owner_id=new.owner_id and a.kind=new.kind and coalesce(a.modification_id,a.build_id,a.fuel_id,a.service_id,a.vehicle_id)=coalesce(new.modification_id,new.build_id,new.fuel_id,new.service_id,new.vehicle_id);
 if count_target>=10 or (select count(*) from public.garage_attachments where owner_id=new.owner_id)>=200 then raise exception 'attachment_quota_reached' using errcode='54000';end if;
 if new.state<>'uploading' then raise exception 'attachment_requires_upload' using errcode='22023';end if;
 return new;
end $$;
create index media_deletion_queue_check_order on public.media_deletion_queue(last_checked_at nulls first);
commit;
