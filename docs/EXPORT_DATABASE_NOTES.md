# Database/API export notes

This is a source-code export, not a live data export or a database backup.

## Active request path

Browser → `app/api/portal/route.ts` → authenticated `campus-portal` Edge Function → Supabase Auth/Postgres/private Storage.

The current Edge API includes session restoration, login/logout, approved account activation, password change/recovery, roster invitations, admin account directory, issue creation/list/detail, updates, audited identity reveal, support, activity/audit reads and evidence upload/download. Read `supabase/functions/campus-portal/index.ts` for exact action names and contracts. All actions share the existing gateway/session/role boundaries.

## Schema material included

`campus360.sql`: initial portal tables and workflow. `account_recovery.sql`: session/credential versions, activation expiry, recovery and rate limiting. `student_privacy_prepare.sql`: Vault-backed field-encryption helpers and encryption-aware RPCs. `student_privacy_enable.sql` and `student_privacy_enable_manual.sql`: one-time field-encryption phase. `issue_support.sql`: support and issue workflow updates. `cloudflare_gateway.sql`: alternate gateway hash column. Other hardening/alias scripts are historical updates.

File order is not a supported installation order. These files contain some overlapping function definitions and assumptions about previous state. The live project’s migration history and schema are authoritative. No database reset, encryption-key retrieval, new account or secret rotation was performed while making this ZIP.

## Credentials and encryption

USNs/names in the live backend use Vault-protected encryption and a keyed login lookup. Copying code does not copy those keys. Passwords are Supabase Auth hashes, not readable passwords. A fresh project must use its own keys and an intentionally migrated dataset; do not overwrite the existing Vault keys or import ciphertext without its corresponding migration plan.

The Worker gateway token is a server secret. Its matching hash is stored in the backend; it is not a public Supabase API key. The `.dev.vars.example` file is deliberately blank for this value. Existing Cloudflare secrets can be retained during redeploy, but their plaintext cannot be recovered from this ZIP.

Supabase platform credentials stay in the Edge Function’s environment. Do not put service-role or secret keys in frontend variables, VS Code screenshots or repository files.
