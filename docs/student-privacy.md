# Student identity encryption — live

The user applied the approved phase-2 transaction in the Supabase SQL editor on 2026-10-19 after connector mutation requests expired. Independent database verification confirmed all 11 account records and all six roster records contain encrypted names and encrypted recoverable logins, with HMAC lookup values in `login`. All three encryption triggers are active. Anonymous profile RPC access and authenticated-client directory access remain denied. The encryption-aware `campus-portal` version 3 is live.

Do not rerun either phase-2 file on this project. The manual SQL transaction is retained as the exact applied rollout artifact, not a recurring maintenance query. The earlier expired-request blocker is resolved by the owner's successful dashboard execution.

## Implemented behavior

- Names and login identifiers in both `c360_users` and `c360_roster` are encrypted using pgcrypto OpenPGP with AES-256, randomized ciphertext and the default integrity protection.
- `login` becomes a deterministic HMAC-SHA-256 lookup value, keyed separately from the encryption key. `login_encrypted` contains the recoverable login; `name` contains encrypted text. Existing primary/foreign keys, Auth IDs, passwords and session versions stay intact.
- Audit action/target fields are encrypted as they may contain USNs or identifying verification reasons. Rate-limit bucket identifiers are keyed; attempts and time windows are retained.
- Encryption keys are generated inside Postgres, stored in Supabase managed encrypted Vault, and never printed or committed. Restricted invoker functions use Vault; no public/anonymous/authenticated grant permits reading identity records, decrypted Vault data or calling these RPCs.
- The Edge Function retains gateway authentication, session expiration, credential-version checks, active/locked checks, role checks, password verification and existing recovery limits. Its profile data reads use restricted decryption-aware RPCs. The browser receives only the same allowed response fields as before.
- Students see their own profile. Staff cannot reveal reporters. The existing admin identity action still checks its reason and writes an audit before returning decrypted name/USN. Public issue responses do not gain reporter information.

This is encryption of selected stored fields, not end-to-end encryption. Database owners and the trusted backend retain decryption capabilities. Role, account state, timestamps, record relationships, issue text and media are outside this field-encryption scope. Free-text descriptions/uploads can identify students; this change does not redact them. Google Sheets exports, historical backups, existing WAL, service logs and previously shared plaintext copies are not rewritten by this migration. Supabase Auth retains its existing hashed internal identifiers/password hashes; changing that separate identity mapping is outside scope.

## Applied rollout and future verification

1. Validate both SQL phases and `tests/student-privacy.sql` together inside `BEGIN ... ROLLBACK`. These checks exercise the actual service role, encryption roundtrips, wrong-key rejection, keyed lookup, roster duplication, activation reuse, new/updated profiles, private reporter permissions, directory output, audits, rate limits and grants.
2. Apply `student_privacy_prepare.sql`: additive encrypted-login columns, protected Vault keys, dual-read server helpers, and decryption-aware existing workflow functions. No ciphertext backfill/triggers yet; legacy Edge behavior remains compatible. **This phase is installed in production.**
3. With explicit approval (now received), deploy `supabase/functions/campus-portal/index.ts` with its pinned dependency and `deno.json`, preserving existing gateway authentication and `verify_jwt:false`. Verify actual sample login/session restoration/directory/roster through the public proxy before continuing.
4. Apply all of `student_privacy_enable.sql` in one transaction. It installs encryption triggers, backfills both identity tables and audit fields, keys existing rate-limit buckets, and updates rate-limit writes. Current v1 constraints prevent accidental plaintext persistence on these paths.
5. Repeat database checks, login/session/role/recovery checks, and the security advisor. Verify counts of readable identities are zero without returning identity contents. Browser end-to-end verification is still required when the browser testing environment is available.

Never deploy the legacy Edge implementation after phase 2: its plaintext lookups cannot find the keyed records. Roll back application code only to an encryption-aware version; retain ciphertext and both Vault keys. Do not delete/rotate either Vault value in place. Future rotation needs a new key version, explicit re-encryption/re-index migration, restore test and retention of old keys until old backups expire. A verified backup/restore and key recovery procedure remain follow-up operational work; they have not been verified by this rollout.

## Current validation

- Database phases + privacy checks passed in a rollback-only transaction; no existing identity/account data was changed by that test.
- TypeScript checks passed. The Edge boundary test uses synthetic provider data, not a deployed Edge Function.
- Recovery tests against encrypted rows passed inside rollback: the keyed lookup found the account, consumed its code once, incremented its credential version, revoked sessions and rejected stale session creation.
- Verified production state after migration: 11/11 account records encrypted, 6/6 roster records encrypted, three active encryption triggers, successful own-profile decryption, and denied direct client identity/directory RPCs. Account passwords were not changed.
- The security advisor reported only the pre-existing disabled leaked-password protection warning: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- The encryption-aware Edge Function version 3 is live. All eight public-proxy checks passed before migration. All eight checks also passed after migration through the public Sites proxy: existing student password sign-in, session restoration, own-profile/feed decryption, campus issue detail without reporter fields, student identity-reveal denial, student account-directory denial, logout and logged-out feed denial. No browser end-to-end test was performed.

References: https://supabase.com/docs/guides/database/vault and https://www.postgresql.org/docs/current/pgcrypto.html . AES-256 explicitly avoids the legacy Blowfish/CAST5 cipher issue described in the 2026-09-25 Supabase changelog.
