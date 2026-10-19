-- Phase 1: install dual-read helpers BEFORE deploying the encryption-aware Edge Function.
-- Keys are generated inside Postgres and stored only in managed encrypted Vault.
create schema if not exists c360_private;
revoke all on schema c360_private from public,anon,authenticated;
grant usage on schema c360_private to service_role;
do $$ begin
 if not exists(select 1 from vault.secrets where name='c360_pii_encrypt_v1') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'c360_pii_encrypt_v1','CAMPUS360 identity encryption; retain for all v1 ciphertext');
 end if;
 if not exists(select 1 from vault.secrets where name='c360_pii_index_v1') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'c360_pii_index_v1','CAMPUS360 keyed identity lookup; retain for all v1 indexes');
 end if;
end $$;
alter table public.c360_users add column if not exists login_encrypted text;
alter table public.c360_roster add column if not exists login_encrypted text;

create or replace function c360_private.seal(value text) returns text
language plpgsql security invoker set search_path='' as $$
declare k text;
begin
 if value is null then return null;end if;
 select decrypted_secret into strict k from vault.decrypted_secrets where name='c360_pii_encrypt_v1';
 return 'pii:v1:'||encode(extensions.pgp_sym_encrypt(value,k,'cipher-algo=aes256,compress-algo=0'),'base64');
end $$;
create or replace function c360_private.unseal(value text) returns text
language plpgsql security invoker stable set search_path='' as $$
declare k text;
begin
 if value is null or left(value,7)<>'pii:v1:' then return value;end if;
 select decrypted_secret into strict k from vault.decrypted_secrets where name='c360_pii_encrypt_v1';
 return extensions.pgp_sym_decrypt(decode(substr(value,8),'base64'),k);
end $$;
create or replace function c360_private.lookup(value text) returns text
language plpgsql security invoker stable set search_path='' as $$
declare k text;
begin
 select decrypted_secret into strict k from vault.decrypted_secrets where name='c360_pii_index_v1';
 return 'idx:v1:'||encode(extensions.hmac(upper(trim(value)),k,'sha256'),'hex');
end $$;
create or replace function c360_private.profile(value jsonb) returns jsonb
language sql security invoker stable set search_path='' as $$
 select case when value is null then null else (value-'login_encrypted')||jsonb_build_object(
 'name',c360_private.unseal(value->>'name'),
 'login',c360_private.unseal(coalesce(value->>'login_encrypted',value->>'login'))) end;
$$;
-- Restricted server RPCs replace direct lookups. Never return these full records to visitors.
create or replace function public.c360_get_profile(l text default null,uid text default null) returns jsonb
language sql security invoker set search_path='' as $$
 select c360_private.profile(to_jsonb(u)) from public.c360_users u
 where (uid is not null and u.id=uid) or (uid is null and l is not null and u.login in(l,c360_private.lookup(l))) limit 1;
$$;
create or replace function public.c360_account_directory() returns jsonb
language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(v order by v->>'login'),'[]'::jsonb) from (
 select jsonb_build_object('login',c360_private.unseal(coalesce(login_encrypted,login)),
 'name',c360_private.unseal(name),'role',role,'active',active) v from public.c360_users limit 1000)t;
$$;
create or replace function public.c360_import_roster(rows jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare out_data jsonb;
begin
 with inserted as (
 insert into public.c360_roster(login,name,role,code,expires_at)
 select x.login,x.name,x.role,x.code,x.expires_at from jsonb_to_recordset(rows) as x(login text,name text,role text,code text,expires_at timestamptz)
 on conflict(login) do nothing returning login,login_encrypted)
 select coalesce(jsonb_agg(c360_private.unseal(coalesce(login_encrypted,login))),'[]'::jsonb) into out_data from inserted;
 return out_data;
end $$;
create or replace function public.c360_reissue_activation(l text,h text,e timestamptz) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 update public.c360_roster set code=h,used=0,expires_at=e where login in(l,c360_private.lookup(l));
 return found;
end $$;
-- Encryption is enabled only in phase 2, after the Edge Function can use these helpers.
create or replace function c360_private.encrypt_profile() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if left(new.login,7)<>'idx:v1:' then
  new.login_encrypted:=c360_private.seal(upper(trim(new.login)));
  new.login:=c360_private.lookup(new.login);
 elsif new.login_encrypted is null then
  raise exception 'Encrypted login is required';
 end if;
 if new.login<>c360_private.lookup(c360_private.unseal(new.login_encrypted)) then raise exception 'Encrypted login does not match lookup';end if;
 if left(new.name,7)<>'pii:v1:' then new.name:=c360_private.seal(new.name);
 else perform c360_private.unseal(new.name);end if;
 return new;
end $$;
create or replace function c360_private.encrypt_audit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if left(new.action,7)<>'pii:v1:' then new.action:=c360_private.seal(new.action);end if;
 if left(new.target,7)<>'pii:v1:' then new.target:=c360_private.seal(new.target);end if;
 return new;
end $$;
revoke all on all functions in schema c360_private from public,anon,authenticated;
grant execute on all functions in schema c360_private to service_role;
revoke all on function public.c360_get_profile(text,text),public.c360_account_directory(),public.c360_import_roster(jsonb),public.c360_reissue_activation(text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.c360_get_profile(text,text),public.c360_account_directory(),public.c360_import_roster(jsonb),public.c360_reissue_activation(text,text,timestamptz) to service_role;

create or replace function public.c360_claim_activation(l text,h text,r text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare x public.c360_roster%rowtype;
begin
 select * into x from public.c360_roster where login in(l,c360_private.lookup(l)) for update;
 if not found or x.used<>0 or x.code<>h or x.expires_at<=now() or x.role<>r
 or exists(select 1 from public.c360_users where login in(l,c360_private.lookup(l)) and auth_id is not null) then
 raise exception 'Account activation could not be verified. Ask your administrator for a new code.';end if;
 update public.c360_roster set used=1 where login=x.login;
 return jsonb_build_object('login',c360_private.unseal(coalesce(x.login_encrypted,x.login)),'name',c360_private.unseal(x.name),'role',x.role);
end;$$;


create or replace function public.c360_begin_recovery(l text,h text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare x public.c360_users%rowtype; matched text;
begin
 select * into x from public.c360_users where login in(l,c360_private.lookup(l)) for update;
 if not found or x.active<>1 or x.auth_id is null or x.role='admin' or x.credentials_locked then return null;end if;
 delete from public.c360_recovery where user_id=x.id and code_hash=h and expires_at>now() returning user_id into matched;
 if matched is null then return null;end if;
 update public.c360_users set credential_version=credential_version+1,credentials_locked=true where id=x.id returning * into x;
 delete from public.c360_sessions where user_id=x.id;
 insert into public.c360_audits(actor,action,target) values(x.id,'password-reset-started',l);
 return jsonb_build_object('id',x.id,'auth_id',x.auth_id,'version',x.credential_version);
end;$$;


create or replace function public.c360_operation(p jsonb, actor text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 u public.c360_users%rowtype; c public.c360_complaints%rowtype;
 a text:=p->>'action'; own boolean; out_data jsonb; new_status text; op text; msg text; new_id uuid; reporter_id text;
begin
 select * into u from public.c360_users where id=actor and active=1;
 if not found then raise exception 'Please log in.';end if;
 if a='list' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created desc),'[]') into out_data from(
   select ci.*,r.user_id=u.id as own, (select count(*) from public.c360_issue_support s where s.complaint_id=ci.id) as support_count, exists(select 1 from public.c360_issue_support s where s.complaint_id=ci.id and s.user_id=u.id) as supported from public.c360_complaints ci join public.c360_reporters r on r.complaint_id=ci.id
   where u.role='admin' or r.user_id=u.id or ci.visibility='campus')t;
  return jsonb_build_object('complaints',out_data,'viewer',jsonb_build_object('name',c360_private.unseal(u.name),'login',c360_private.unseal(coalesce(u.login_encrypted,u.login)),'role',u.role));
 elsif a='create' then
  if u.role<>'student' then raise exception 'Only students can submit issues.';end if;
  if coalesce(trim(p->>'title'),'')='' or coalesce(trim(p->>'description'),'')='' or coalesce(trim(p->>'location'),'')='' then raise exception 'Complete title, description and location.';end if;
  insert into public.c360_complaints(title,description,category,location,visibility) values(trim(p->>'title'),trim(p->>'description'),left(coalesce(p->>'category','Other'),80),left(trim(p->>'location'),150),case when p->>'visibility'='campus' then 'campus' else 'private' end) returning id into new_id;
  insert into public.c360_reporters values(new_id,u.id);
  insert into public.c360_events(complaint_id,label,message) values(new_id,'Reporting student','Issue submitted. Reporter identity is protected.');
  return jsonb_build_object('id',new_id);
 elsif a='activity' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created desc),'[]') into out_data from(
   select e.label,e.message,e.created,ci.title,ci.id from public.c360_events e join public.c360_complaints ci on ci.id=e.complaint_id join public.c360_reporters r on r.complaint_id=ci.id
   where u.role='admin' or r.user_id=u.id or (u.role='staff' and ci.visibility='campus') order by e.created desc limit 50)t;
  return jsonb_build_object('activity',out_data);
 elsif a='audits' then
  if u.role<>'admin' then raise exception 'Forbidden';end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created desc),'[]') into out_data from(select c360_private.unseal(action) as action,c360_private.unseal(target) as target,created from public.c360_audits order by created desc limit 100)t;
  return jsonb_build_object('audits',out_data);
 end if;
 select * into c from public.c360_complaints where id=(p->>'id')::uuid for update;
 if not found then raise exception 'Issue not found';end if;
 select user_id into reporter_id from public.c360_reporters where complaint_id=c.id;
 own:=reporter_id=u.id;
 if not(u.role='admin' or own or c.visibility='campus') then raise exception 'Forbidden';end if;
 if a='support' then
  if u.role<>'student' or c.visibility<>'campus' then raise exception 'Only students can support campus-visible issues.';end if;
  if jsonb_typeof(p->'supported') is distinct from 'boolean' then raise exception 'Include an explanation: choose whether to support this issue.';end if;
  if not public.c360_auth_limit('support:'||u.id) then raise exception 'Too many attempts. Try again in 15 minutes.';end if;
  if (p->>'supported')::boolean then
   insert into public.c360_issue_support(complaint_id,user_id) values(c.id,u.id) on conflict do nothing;
  else
   delete from public.c360_issue_support where complaint_id=c.id and user_id=u.id;
  end if;
  return jsonb_build_object('support_count',(select count(*) from public.c360_issue_support s where s.complaint_id=c.id),'supported',exists(select 1 from public.c360_issue_support s where s.complaint_id=c.id and s.user_id=u.id));
 elsif a='detail' then
  return jsonb_build_object('complaint',to_jsonb(c)||jsonb_build_object('own',own,'support_count',(select count(*) from public.c360_issue_support s where s.complaint_id=c.id),'supported',exists(select 1 from public.c360_issue_support s where s.complaint_id=c.id and s.user_id=u.id)),
   'events',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created),'[]') from(select label,message,created from public.c360_events where complaint_id=c.id)t),
   'attachments',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',type,'size',size)),'[]') from public.c360_attachments where complaint_id=c.id));
 elsif a='identity' then
  if u.role<>'admin' then raise exception 'Reporter identity is restricted';end if;
  if coalesce(trim(p->>'reason'),'')='' then raise exception 'Enter a purpose for accessing identity.';end if;
  insert into public.c360_audits(actor,action,target) values(u.id,'identity-access: '||left(p->>'reason',200),c.id::text);
  return jsonb_build_object('reporter',(select jsonb_build_object('name',c360_private.unseal(name),'login',c360_private.unseal(coalesce(login_encrypted,login))) from public.c360_users where id=reporter_id));
 elsif a='upload-permission' then
  if not(own or u.role='admin') then raise exception 'Forbidden';end if;return jsonb_build_object('ok',true);
 elsif a='download-permission' then
  select jsonb_build_object('id',id,'key',key,'type',type,'size',size) into out_data from public.c360_attachments where id=(p->>'attachment')::uuid and complaint_id=c.id;
  if out_data is null then raise exception 'Attachment not found';end if;return out_data;
 elsif a='update' then
  op:=p->>'operation';msg:=trim(coalesce(p->>'message',''));new_status:=c.status;
  if length(msg)>5000 or(msg='' and op<>'confirm')then raise exception 'Include an explanation up to 5000 characters.';end if;
  if op='comment' then
   if not(u.role='admin' or own)then raise exception 'Staff access is read-only';end if;
  elsif u.role='admin' and op='start' and c.status in('Submitted','Reopened','Awaiting information')then new_status:='In progress';
  elsif u.role='admin' and op='ask' and c.status in('Submitted','In progress','Reopened')then new_status:='Awaiting information';
  elsif u.role='admin' and op='resolve' and c.status in('Submitted','In progress','Reopened','Awaiting information')then new_status:='Resolved';
  elsif u.role='student' and own and c.status='Resolved' and op='confirm'then new_status:='Closed';
  elsif u.role='student' and own and c.status='Resolved' and op='reopen'then new_status:='Reopened';
  else raise exception 'This status change is not permitted.';end if;
  update public.c360_complaints set status=new_status,
   priority=case when u.role='admin' and p->>'priority' in('Normal','High','Urgent')then p->>'priority' else priority end,
   deadline=case when u.role='admin' and coalesce(p->>'deadline','')<>''then(p->>'deadline')::date else deadline end where id=c.id;
  insert into public.c360_events(complaint_id,label,message) values(c.id,case when u.role='admin' then 'College administration' else 'Reporting student'end,
   case when op='confirm'then 'Resolution confirmed. Issue closed.' when op='comment'then msg else new_status||': '||msg end);
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown action';
end;
$$;
