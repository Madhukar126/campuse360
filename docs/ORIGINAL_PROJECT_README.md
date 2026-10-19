# CAMPUS360 — Supabase edition

Student voice portal with confidential reporter identities and admin-led resolution.

## Active architecture
Browser -> same-origin Sites API -> authenticated Supabase Edge Function -> Supabase Auth / Postgres / private Storage.

- `app/page.tsx`: Student, Staff and Admin UI.
- `app/api/portal/route.ts`: origin validation, trusted identity forwarding, and gateway proxy. It never forwards client-supplied administrative identity headers.
- `supabase/functions/campus-portal/index.ts`: authenticated backend, Supabase Auth registration/login, expiring portal sessions, roster activation, evidence handling.
- `supabase/schema/campus360.sql`: initial table and transactional complaint workflow definitions. Hosted migration history is authoritative; subsequent hardening migrations add explicit server-only RLS policies and revoke public access to the project's pre-existing RLS helper.
- `tests/supabase-live.py`: live backend integration checks, with credentials supplied through hidden stdin.

## Account security
Supabase Auth stores password hashes. There is no application password column. USNs are mapped internally to deterministic non-deliverable Auth aliases; these are identifiers, not real contact email addresses. Portal authorization uses server-owned profile records, never editable user metadata. New students and staff must be preloaded by admins and verify a privately issued activation code.

The browser receives an opaque, expiring HTTP-only Secure SameSite session cookie. Supabase service keys remain inside the Edge Function's managed environment. The Sites proxy authenticates to the function with a runtime secret; the function verifies its hash against a server-only database record before processing any request. `verify_jwt` is disabled because this server-to-server gateway uses custom authentication, including for account activation before user sign-in. A direct unauthenticated request is rejected.

All portal tables have RLS enabled with server-only policies and no anon/authenticated table privileges. `c360_operation` is SECURITY INVOKER and executable only by service_role. It enforces the actual portal user, ownership, visibility, and action rules. This is a backend-mediated design; no browser Supabase Data API client is granted direct portal access.

## Data
- `c360_users`: identifiers, names, trusted roles, active flag, Supabase Auth ID.
- `c360_roster`: eligible accounts and hashed activation codes.
- `c360_sessions`: hashed opaque session tokens and expiry.
- `c360_complaints`: content, status, visibility, priority and deadline.
- `c360_reporters`: protected complaint-to-student relationship.
- `c360_events`: identity-safe progress history.
- `c360_attachments`: private evidence object metadata.
- `c360_audits`: sensitive access and authentication events.
- `c360_gateway`: backend gateway credential hash.
- `campus360-evidence`: private Supabase Storage bucket, maximum 5 MB per file.

## Permissions and workflow
Students submit, reply, confirm or reopen their own reports. Staff only view campus-visible reports. Admins handle and resolve complaints. Reporter identity is returned only to an admin explicitly providing a purpose; access is audited.

Submitted -> In progress -> Resolved -> Closed. Additional actions request information and reopen unresolved complaints. SQL operations atomically save the complaint status and its timeline event and lock the complaint row during changes.

## Initial administration
Open the site as its owner and select Set up first administrator. Owner eligibility is checked against the configured hosting identity email, not a visitor-supplied form field. If the owner identity is absent on the public site, use the platform's Sign in with ChatGPT route before setup. Import actual college records under Student & staff roster and distribute activation codes through a verified college channel. Test fixtures are not college accounts.

## Migration
The pre-existing Darshan student profile and USN are preserved, and its password is migrated through Supabase Auth. Existing browser sessions require sign-in again. Old D1/R2 bindings are retained for rollback and historical access, but the active API no longer writes to them. Supabase does not receive old custom password hashes. There were no complaints or attachments at the migration snapshot.

## Runtime settings
- SUPABASE_PORTAL_URL
- SUPABASE_GATEWAY_TOKEN (secret)
- OWNER_EMAIL (secret)
- ACCOUNT_PROVISION_TOKEN (secret, optional controlled account provisioning)
Never store runtime secret values in tracked source or hosting.json.

## Remaining limitations
- Real college email/OTP, verified self-service password recovery, MFA and automated escalation are not configured.
- Authentication aliases cannot receive recovery emails; actual verified contact data and recovery flow must be added before institutional rollout.
- All current admins share identity access. Designated officer restrictions require additional permissions.
- Attachments require users to remove identifying content and photo metadata; automatic redaction, metadata stripping and malware scanning are not implemented.
- Supabase's leaked-password-protection advisor must be reviewed and enabled in the project dashboard where supported by the plan.
- No push/email notifications, unread counters, anonymous reporting, duplicate detection or exports.
- Full browser visual testing, independent security review, load testing, backup restoration and retention policy remain.

## Tests
Live integration tests validate actual Supabase Auth login, session logout, role mismatch, private-issue denial, staff read-only access, identity-safe responses, admin identity auditing, status transitions, reopen/confirmation, and private Storage upload/download permissions. Fixtures are removed after testing. TypeScript and production build checks cover the hosted proxy/UI. Older D1 tests under tests/ are historical and are not evidence for this Supabase backend.
