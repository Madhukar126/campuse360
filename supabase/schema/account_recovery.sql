-- Server-only account lifecycle. All credentials and codes remain outside exports.
alter table public.c360_roster add column if not exists expires_at timestamptz not null default (now() + interval '7 days');
alter table public.c360_users add column if not exists credential_version integer not null default 0;
alter table public.c360_users add column if not exists credentials_locked boolean not null default false;
alter table public.c360_sessions add column if not exists credential_version integer not null default 0;
create table if not exists public.c360_recovery (
 user_id text primary key references public.c360_users(id),
 code_hash text not null, expires_at timestamptz not null
);
create table if not exists public.c360_auth_limits (
 bucket text primary key, window_start timestamptz not null default now(), attempts integer not null default 1
);
alter table public.c360_recovery enable row level security;
alter table public.c360_auth_limits enable row level security;
revoke all on public.c360_recovery,public.c360_auth_limits from public,anon,authenticated;
grant select,insert,update,delete on public.c360_recovery,public.c360_auth_limits to service_role;
create policy server_only on public.c360_recovery for all to service_role using (true) with check (true);
create policy server_only on public.c360_auth_limits for all to service_role using (true) with check (true);

create or replace function public.c360_auth_limit(b text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into public.c360_auth_limits(bucket) values(b)
 on conflict(bucket) do update set
 attempts=case when c360_auth_limits.window_start < now()-interval '15 minutes' then 1 else least(c360_auth_limits.attempts+1,21) end,
 window_start=case when c360_auth_limits.window_start < now()-interval '15 minutes' then now() else c360_auth_limits.window_start end
 returning attempts into n;
 return n<=20;
end;$$;

create or replace function public.c360_claim_activation(l text,h text,r text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare x public.c360_roster%rowtype;
begin
 select * into x from public.c360_roster where login=l for update;
 if not found or x.used<>0 or x.code<>h or x.expires_at<=now() or x.role<>r
 or exists(select 1 from public.c360_users where login=l and auth_id is not null) then
 raise exception 'Account activation could not be verified. Ask your administrator for a new code.';end if;
 update public.c360_roster set used=1 where login=l;
 return jsonb_build_object('login',x.login,'name',x.name,'role',x.role);
end;$$;

create or replace function public.c360_login_session(uid text,v integer,t text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare x public.c360_users%rowtype;
begin
 select * into x from public.c360_users where id=uid for update;
 if not found or x.active<>1 or x.credentials_locked or x.credential_version<>v then return false;end if;
 insert into public.c360_sessions(token,user_id,expires,credential_version) values(t,uid,(extract(epoch from clock_timestamp())*1000)::bigint+28800000,v);
 return true;
end;$$;

create or replace function public.c360_begin_recovery(l text,h text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare x public.c360_users%rowtype; matched text;
begin
 select * into x from public.c360_users where login=l for update;
 if not found or x.active<>1 or x.auth_id is null or x.role='admin' or x.credentials_locked then return null;end if;
 delete from public.c360_recovery where user_id=x.id and code_hash=h and expires_at>now() returning user_id into matched;
 if matched is null then return null;end if;
 update public.c360_users set credential_version=credential_version+1,credentials_locked=true where id=x.id returning * into x;
 delete from public.c360_sessions where user_id=x.id;
 insert into public.c360_audits(actor,action,target) values(x.id,'password-reset-started',l);
 return jsonb_build_object('id',x.id,'auth_id',x.auth_id,'version',x.credential_version);
end;$$;

create or replace function public.c360_begin_password_change(uid text,v integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare x public.c360_users%rowtype;
begin
 select * into x from public.c360_users where id=uid for update;
 if not found or x.active<>1 or x.credentials_locked or x.credential_version<>v then return null;end if;
 update public.c360_users set credential_version=credential_version+1,credentials_locked=true where id=uid returning * into x;
 delete from public.c360_sessions where user_id=uid;
 delete from public.c360_recovery where user_id=uid;
 return jsonb_build_object('id',uid,'auth_id',x.auth_id,'version',x.credential_version);
end;$$;

revoke all on function public.c360_auth_limit(text),public.c360_claim_activation(text,text,text),public.c360_login_session(text,integer,text),public.c360_begin_recovery(text,text) from public,anon,authenticated;
grant execute on function public.c360_auth_limit(text),public.c360_claim_activation(text,text,text),public.c360_login_session(text,integer,text),public.c360_begin_recovery(text,text) to service_role;
revoke all on function public.c360_begin_password_change(text,integer) from public,anon,authenticated;
grant execute on function public.c360_begin_password_change(text,integer) to service_role;
