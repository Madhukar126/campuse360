do $$ declare t text; begin foreach t in array array['c360_gateway','c360_users','c360_roster','c360_sessions','c360_complaints','c360_reporters','c360_events','c360_attachments','c360_audits'] loop execute format('create policy server_only on public.%I for all to service_role using (true) with check (true)',t);end loop;end $$;
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
drop index public.c360_users_auth_idx;
