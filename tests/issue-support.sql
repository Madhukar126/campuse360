begin;
do $$
declare s text; other_student text; staff text; admin text; v jsonb; n integer; denied boolean; private_id uuid;
campus uuid:='06563462-7d9c-4575-bac8-91b13bc3e87b';
begin
 select id into s from public.c360_users where login='SAMPLE001';
 select id into other_student from public.c360_users where login='SAMPLE002';
 select id into staff from public.c360_users where login='QA_STAFF';
 select id into admin from public.c360_users where role='admin' and active=1 limit 1;
 update public.c360_users set active=1 where id=staff;
 select id into private_id from public.c360_complaints where visibility='private' limit 1;
 select count(*) into n from public.c360_issue_support where complaint_id=campus;
 v:=public.c360_operation(jsonb_build_object('action','support','id',campus,'supported',true,'user_id',other_student),s);
 if (v->>'support_count')::integer<>n+1 or not(v->>'supported')::boolean then raise exception 'Support was not added for authenticated actor';end if;
 v:=public.c360_operation(jsonb_build_object('action','support','id',campus,'supported',true),s);
 if (v->>'support_count')::integer<>n+1 then raise exception 'Duplicate support counted';end if;
 if exists(select 1 from public.c360_issue_support where complaint_id=campus and user_id=other_student) then raise exception 'Actor spoof accepted';end if;
 v:=public.c360_operation(jsonb_build_object('action','detail','id',campus),other_student);
 if (v->'complaint'->>'support_count')::integer<>n+1 or (v->'complaint'->>'supported')::boolean then raise exception 'Other viewer support state incorrect';end if;
 if v::text like '%SAMPLE001%' or v::text like '%Sample Student One%' then raise exception 'Supporter identity leaked';end if;
 foreach staff in array array[staff,admin] loop
  denied:=false;
  begin perform public.c360_operation(jsonb_build_object('action','support','id',campus,'supported',true),staff);exception when others then denied:=sqlerrm like 'Only students%';end;
  if not denied then raise exception 'Non-student supported';end if;
 end loop;
 denied:=false;
 begin perform public.c360_operation(jsonb_build_object('action','support','id',private_id,'supported',true),s);exception when others then denied:=true;end;
 if not denied then raise exception 'Private issue support accepted';end if;
 v:=public.c360_operation(jsonb_build_object('action','support','id',campus,'supported',false),s);
 if (v->>'support_count')::integer<>n or (v->>'supported')::boolean then raise exception 'Support removal failed';end if;
 v:=public.c360_operation(jsonb_build_object('action','support','id',campus,'supported',false),s);
 if (v->>'support_count')::integer<>n then raise exception 'Repeated removal changed count';end if;
 if has_table_privilege('anon','public.c360_issue_support','select') or has_table_privilege('authenticated','public.c360_issue_support','insert') then raise exception 'Support table exposed';end if;
end $$;
rollback;
