# CAMPUS360 on Cloudflare Workers

Published on 2026-10-19: https://campus360.studentvoice.workers.dev

- Worker: `campus360`
- Cloudflare account: `1f974812368cacbe5c40f3c111d1f3d9`
- Worker version: `3955f4f1-b75e-409c-9470-18cf72ec3ade`
- Supabase Edge Function: `campus-portal` version 4
- Existing Sites deployment remains available and passed all eight live login/privacy checks after this gateway update.

The user explicitly approved storing the newly generated dedicated gateway credential in Cloudflare and deploying the matching Supabase gateway change. Both succeeded after the initial automatic review blocks. No further confirmation is required for those already authorized actions. The Cloudflare secret upload was confirmed by Wrangler. The `cloudflare_token_hash` column stores only its SHA-256 hash; the original Sites token hash remains unchanged. Database verification confirmed distinct configured credentials, denied client reads of the gateway table and 11 encrypted account identities.

## Build and redeploy

Keep the existing Vinext/Sites build integration and pinned dependencies. Run the existing build command, then `node scripts/prepare-workers-export.mjs`. The generated `dist/cloudflare/wrangler.json` uses the selected account, the existing server/client output, native static assets and no placeholder D1/R2 bindings. The wrapper strips visitor-supplied ChatGPT identity/provisioning headers. Do not configure `OWNER_EMAIL` or `ACCOUNT_PROVISION_TOKEN` on the direct Cloudflare deployment.

Use isolated Wrangler 4.151.1 (the project's pinned Wrangler 4.92.0 remains unchanged):

```
npm exec --yes --package=wrangler@4.151.1 -- wrangler deploy --config dist/cloudflare/wrangler.json
```

The encrypted `SUPABASE_GATEWAY_TOKEN` secret is already configured in the user's Cloudflare account. Do not rotate or re-upload it for routine deployments. Never print it, commit it, put it in argv, or put it in Wrangler vars. `SUPABASE_PORTAL_URL` is non-secret public configuration. Retain both backend gateway hashes to keep both origins operational. Password hashes, student field encryption and uploads remain in Supabase.

A free account-level subdomain `studentvoice.workers.dev` was registered using the standard Wrangler prompt. The application is at `campus360.studentvoice.workers.dev`. No paid plan, billing upgrade, custom domain, D1 database or R2 bucket was created.

## Validation

- Worker dry run and TypeScript passed; upload is about 272 KiB gzip, reported startup 16 ms.
- Gateway tests passed for legacy/new credentials, unknown-key rejection and disabled alternate-key rejection, along with existing account/session/role checks.
- Eight real login/privacy checks passed against the existing Sites origin with Edge version 4.
- The new workers.dev deployment was confirmed by Wrangler, including its exact URL and version.
- After the account subdomain rename, all 11 live login, session, privacy and request-boundary checks passed on `campus360.studentvoice.workers.dev`. No browser QA was performed.
