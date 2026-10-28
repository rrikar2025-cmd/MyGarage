begin;
create table public.garage_job_settings(id boolean primary key default true check(id),job_key_hash text not null);
alter table public.garage_job_settings enable row level security;
revoke all on public.garage_job_settings from public,anon,authenticated;
grant select on public.garage_job_settings to service_role;
-- The scheduler key is generated inside Postgres and stored in Vault, never printed or sent to the app.
do $$ declare secret text:=encode(extensions.gen_random_bytes(32),'hex');begin
 insert into public.garage_job_settings(id,job_key_hash) values(true,encode(extensions.digest(secret,'sha256'),'hex'));
 perform vault.create_secret(secret,'mygarage_job_key','Private scheduler authorization for My Garage');
end $$;
commit;
