-- Add a dedicated Cloudflare credential without rotating the existing Sites key.
-- Applied via the cloudflare_gateway_credential migration on 2026-10-19.
alter table public.c360_gateway add column if not exists cloudflare_token_hash text;
comment on column public.c360_gateway.cloudflare_token_hash is
'SHA-256 of the dedicated Cloudflare Worker gateway secret; NULL disables it. Existing token_hash remains unchanged.';
-- Populate only the hash through the authorized deployment session; never put
-- a plaintext token in this file. Cloudflare secret upload and the matching
-- live Edge gateway deployment await the explicit approval requested by review.
