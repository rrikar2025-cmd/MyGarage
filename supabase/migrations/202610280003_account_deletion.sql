-- Only the authenticated owner can remove their account, after fresh password authentication.
-- The expected id guards account-switch races; it never grants authority to delete another user.
-- No service role credentials in the mobile client.
drop function if exists public.delete_own_account(text);
create or replace function public.delete_own_account(p_confirmation text, p_expected_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  claims jsonb := auth.jwt();
  session_uuid uuid;
begin
  if actor is null or p_expected_user is distinct from actor or p_confirmation is distinct from 'DELETE_MY_ACCOUNT' then
    raise exception 'account_deletion_not_authorized' using errcode = '42501';
  end if;
  begin
    session_uuid := (claims ->> 'session_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'account_deletion_not_authorized' using errcode = '42501';
  end;
  if session_uuid is null or not exists (
    select 1 from auth.sessions s where s.id = session_uuid and s.user_id = actor
  ) or not exists (
    select 1 from jsonb_array_elements(coalesce(claims -> 'amr', '[]'::jsonb)) method
    where method ->> 'method' = 'password'
      and (method ->> 'timestamp')::numeric between
        extract(epoch from now()) - 300 and extract(epoch from now()) + 30
  ) then
    raise exception 'fresh_password_authentication_required' using errcode = '42501';
  end if;
  delete from auth.users where id = actor;
  if not found then
    raise exception 'account_deletion_not_authorized' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.delete_own_account(text, uuid) from public, anon;
grant execute on function public.delete_own_account(text, uuid) to authenticated;
