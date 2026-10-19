create table public.c360_issue_support (
 complaint_id uuid not null references public.c360_complaints(id) on delete cascade,
 user_id text not null references public.c360_users(id),
 created timestamptz not null default now(),
 primary key(complaint_id,user_id)
);
create index c360_issue_support_user_idx on public.c360_issue_support(user_id);
alter table public.c360_issue_support enable row level security;
revoke all on public.c360_issue_support from public,anon,authenticated;
grant select,insert,delete on public.c360_issue_support to service_role;
create policy server_only on public.c360_issue_support for all to service_role using(true) with check(true);

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
  return jsonb_build_object('complaints',out_data,'viewer',jsonb_build_object('name',u.name,'login',u.login,'role',u.role));
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
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created desc),'[]') into out_data from(select action,target,created from public.c360_audits order by created desc limit 100)t;
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
  return jsonb_build_object('reporter',(select jsonb_build_object('name',name,'login',login) from public.c360_users where id=reporter_id));
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
