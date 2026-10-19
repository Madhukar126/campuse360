-- Execute after both privacy SQL files within a ROLLBACK-only transaction.
set local role service_role;
do $$
declare p jsonb; result jsonb; sid text; aid text; issue uuid; failed boolean; sealed text; k text;
begin
 p:=public.c360_get_profile('SAMPLE001',null);
 if p->>'login'<>'SAMPLE001' or p->>'name'<>'Sample Student One' then raise exception 'Existing profile lookup/decryption failed';end if;
 sid:=p->>'id';
 if public.c360_get_profile(null,sid)<>p then raise exception 'Session profile lookup changed';end if;
 if exists(select 1 from public.c360_users where left(login,7)<>'idx:v1:' or left(name,7)<>'pii:v1:' or login_encrypted is null)
 or exists(select 1 from public.c360_roster where left(login,7)<>'idx:v1:' or left(name,7)<>'pii:v1:' or login_encrypted is null) then raise exception 'Plaintext identity remains';end if;
 sealed:=c360_private.seal('Synthetic privacy test');
 if c360_private.unseal(sealed)<>'Synthetic privacy test' or sealed=c360_private.seal('Synthetic privacy test') then raise exception 'Roundtrip or randomized encryption failed';end if;
 failed:=false;
 begin perform extensions.pgp_sym_decrypt(decode(substr(sealed,8),'base64'),'deliberately-wrong-key');exception when others then failed:=true;end;
 if not failed then raise exception 'Wrong key decrypted ciphertext';end if;
 result:=public.c360_import_roster('[{"login":"PRIVACY_TEST_001","name":"Privacy Student","role":"student","code":"test-hash","expires_at":"2099-01-01T00:00:00Z"}]');
 if result<>'["PRIVACY_TEST_001"]'::jsonb then raise exception 'Roster import login return failed';end if;
 result:=public.c360_import_roster('[{"login":"PRIVACY_TEST_001","name":"Duplicate","role":"student","code":"replacement","expires_at":"2099-01-01T00:00:00Z"}]');
 if result<>'[]'::jsonb then raise exception 'Duplicate roster import replaced record';end if;
 if not public.c360_reissue_activation('PRIVACY_TEST_001','new-hash','2099-01-01T00:00:00Z') then raise exception 'Activation reissue lookup failed';end if;
 result:=public.c360_claim_activation('PRIVACY_TEST_001','new-hash','student');
 if result->>'name'<>'Privacy Student' or result->>'login'<>'PRIVACY_TEST_001' then raise exception 'Activation returned encrypted identity';end if;
 failed:=false;
 begin perform public.c360_claim_activation('PRIVACY_TEST_001','new-hash','student');exception when others then failed:=true;end;
 if not failed then raise exception 'Activation reuse allowed';end if;
 insert into public.c360_users(id,login,name,role) values('privacy-test','PRIVACY_TEST_001','Privacy Student','student');
 p:=public.c360_get_profile('PRIVACY_TEST_001',null);
 if p->>'name'<>'Privacy Student' then raise exception 'New profile trigger/decryption failed';end if;
 update public.c360_users set active=0 where id='privacy-test';
 if (public.c360_get_profile(null,'privacy-test')->>'active')::integer<>0 then raise exception 'Profile update corrupted encryption';end if;
 select id into aid from public.c360_users where role='admin' and active=1 limit 1;
 select complaint_id into issue from public.c360_reporters where user_id=sid limit 1;
 if issue is null then raise exception 'Demo issue fixture missing';end if;
 result:=public.c360_operation(jsonb_build_object('action','identity','id',issue,'reason','Synthetic privacy verification'),aid);
 if result->'reporter'->>'login'<>'SAMPLE001' then raise exception 'Admin identity decryption failed';end if;
 failed:=false;
 begin perform public.c360_operation(jsonb_build_object('action','identity','id',issue,'reason','test'),sid);exception when others then failed:=true;end;
 if not failed then raise exception 'Student accessed reporter identity';end if;
 result:=public.c360_operation(jsonb_build_object('action','list'),sid);
 if result->'viewer'->>'login'<>'SAMPLE001' then raise exception 'Feed viewer decryption failed';end if;
 if result->'complaints' is null then raise exception 'Feed missing';end if;
 result:=public.c360_operation(jsonb_build_object('action','audits'),aid);
 if result->'audits'->0->>'action' like 'pii:v1:%' then raise exception 'Admin audits were not decrypted';end if;
 if exists(select 1 from public.c360_audits where left(action,7)<>'pii:v1:' or left(target,7)<>'pii:v1:') then raise exception 'Plaintext audit remains';end if;
 if not exists(select 1 from jsonb_array_elements(public.c360_account_directory()) a where a->>'login'='SAMPLE001' and a->>'name'='Sample Student One') then raise exception 'Directory decryption failed';end if;
 for i in 1..20 loop
  if not public.c360_auth_limit('privacy-test:SAMPLE001') then raise exception 'Rate limit rejected early';end if;
 end loop;
 if public.c360_auth_limit('privacy-test:SAMPLE001') then raise exception 'Rate limit bypassed';end if;
 if exists(select 1 from public.c360_auth_limits where left(bucket,7)<>'idx:v1:') then raise exception 'Plaintext rate bucket remains';end if;
 -- Password recovery still finds the keyed login and invalidates all old portal sessions.
 p:=public.c360_get_profile('SAMPLE001',null);
 insert into public.c360_recovery(user_id,code_hash,expires_at) values(sid,'privacy-recovery-test',now()+interval '1 minute')
 on conflict(user_id) do update set code_hash=excluded.code_hash,expires_at=excluded.expires_at;
 if not public.c360_login_session(sid,(p->>'credential_version')::integer,'privacy-session-test') then raise exception 'Session creation failed';end if;
 result:=public.c360_begin_recovery('SAMPLE001','privacy-recovery-test');
 if result->>'id'<>sid or (result->>'version')::integer<>(p->>'credential_version')::integer+1 then raise exception 'Encrypted recovery lookup failed';end if;
 if exists(select 1 from public.c360_sessions where user_id=sid) then raise exception 'Recovery did not revoke sessions';end if;
 if public.c360_begin_recovery('SAMPLE001','privacy-recovery-test') is not null then raise exception 'Recovery code reused';end if;
 if public.c360_login_session(sid,(p->>'credential_version')::integer,'privacy-stale-session') then raise exception 'Stale credential session accepted';end if;
 if has_schema_privilege('anon','c360_private','usage') or has_schema_privilege('authenticated','c360_private','usage')
 or has_function_privilege('anon','public.c360_get_profile(text,text)','execute')
 or has_function_privilege('authenticated','public.c360_account_directory()','execute')
 or has_table_privilege('anon','public.c360_users','select') or has_table_privilege('authenticated','public.c360_roster','select')
 or has_table_privilege('anon','vault.decrypted_secrets','select') or has_table_privilege('authenticated','vault.decrypted_secrets','select') then raise exception 'Identity or key access exposed';end if;
end $$;
reset role;
