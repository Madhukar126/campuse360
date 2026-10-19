-- ALREADY APPLIED to production on 2026-10-19; do not rerun.
-- Approved CAMPUS360 phase 2. Backend campus-portal v3 is deployed.
-- Run ONCE in the Supabase SQL editor for project amtjrfkwbwsihhjzhorv.
-- Keep both c360_pii_*_v1 Vault keys; do not modify or delete them.
begin;
-- Phase 2: run ONLY after encryption-aware campus-portal has been deployed and verified.
-- This entire file must run in one transaction; it preserves Auth IDs, passwords and sessions.
lock table public.c360_users,public.c360_roster,public.c360_audits,public.c360_auth_limits in share row exclusive mode;
create trigger c360_encrypt_profile before insert or update on public.c360_users
for each row execute function c360_private.encrypt_profile();
create trigger c360_encrypt_roster before insert or update on public.c360_roster
for each row execute function c360_private.encrypt_profile();
create trigger c360_encrypt_audit before insert or update on public.c360_audits
for each row execute function c360_private.encrypt_audit();
update public.c360_users set login=login,name=name;
update public.c360_roster set login=login,name=name;
update public.c360_audits set action=action,target=target;
alter table public.c360_users add constraint c360_users_encrypted check(left(login,7)='idx:v1:' and login_encrypted is not null and left(login_encrypted,7)='pii:v1:' and left(name,7)='pii:v1:');
alter table public.c360_roster add constraint c360_roster_encrypted check(left(login,7)='idx:v1:' and login_encrypted is not null and left(login_encrypted,7)='pii:v1:' and left(name,7)='pii:v1:');
-- Rate-limit buckets also contain login IDs. Key them without weakening existing counters.
update public.c360_auth_limits set bucket=c360_private.lookup(bucket);
create or replace function public.c360_auth_limit(b text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into public.c360_auth_limits(bucket) values(c360_private.lookup(b))
 on conflict(bucket) do update set
 attempts=case when c360_auth_limits.window_start < now()-interval '15 minutes' then 1 else least(c360_auth_limits.attempts+1,21) end,
 window_start=case when c360_auth_limits.window_start < now()-interval '15 minutes' then now() else c360_auth_limits.window_start end
 returning attempts into n;
 return n<=20;
end;$$;
notify pgrst,'reload schema';

select jsonb_build_object(
'accounts',(select count(*) from public.c360_users),
'encrypted_accounts',(select count(*) from public.c360_users where left(login,7)='idx:v1:'),
'encrypted_roster_rows',(select count(*) from public.c360_roster where left(login,7)='idx:v1:')
) as encryption_state;
commit;
