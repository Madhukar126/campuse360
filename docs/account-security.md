# Account lifecycle

Supabase Auth owns password hashes. The application, account directory, Google Sheets and audit trail do not export passwords or recovery codes.

## Activation

An administrator imports college-approved student/staff records. Codes are random, hashed at rest, expire after seven days, and are shown once. Activation validates the selected role, claims the code under a row lock and requires matching passwords of 12–128 characters. Parallel requests cannot both claim a code. If provider account creation fails after claiming, the administrator must issue a replacement activation code from Account management. Existing accounts use recovery instead.

## Forgotten password

The student or staff member contacts a college administrator. The administrator verifies identity using college records, opens Account management, enters the login ID, records the verification method, and confirms their own password. A random recovery code is shown once and expires in 30 minutes. A replacement code invalidates the previous code. The administrator delivers it privately; the student chooses their own password using Forgot password. Do not put these codes in shared sheets or audit messages.

Code redemption locks the account, increments its credential version, consumes the code and deletes portal sessions in one database transaction. Supabase Auth then updates the password. The account is unlocked only for that version. A stale sign-in cannot create a usable session. Provider failures may require a new code; an uncertain network failure leaves the account locked for project-owner investigation. Resetting an administrator using a student/staff code is forbidden. A lost administrator account requires the Supabase project owner.

## Signed-in password change

Every role can open Account security (Account management for admins), verify the current password, and choose a new password. The operation invalidates existing portal sessions, including the current device. Login IDs and roles are never accepted from the client as authorization.

## Controls and limits

- All recovery tables have RLS and no anonymous/authenticated privileges. Only the server gateway can invoke lifecycle functions.
- Activation, reset, password change, sign-in and code issuance use atomic per-account/operation limits: 20 attempts in 15 minutes. Rate-limit buckets contain no passwords, codes or provider tokens.
- Admin-only directory returns login, name, role and active status, with a 1,000-record bound. It is not a password export.
- Supabase provider tokens used to verify passwords remain on the server and are signed out after verification. Browser sessions use the existing secure, HttpOnly cookie.
- Old passwords are not automatically changed by this release. Previously recorded credentials should be changed by their holders.
- Supabase Security Advisor currently reports leaked-password protection disabled. Review provider plan/settings before college rollout.
- Google Sheets remains a manual reporting copy, without automatic synchronization.

## Verification

`tests/account-recovery-live.py` exercises the public portal using hidden stdin credentials and temporary, clearly labelled accounts. It tests activation/recovery races, role restrictions, replacement and reused codes, password confirmation, current-password verification, session invalidation, and private/campus issue access. Disable its account prefix after each run; it leaves one clearly labelled, private, closed issue as evidence. Database transaction checks cover expired recovery codes, stale login versions, rate limits and anonymous access without changing existing accounts.

TypeScript checking, the production build and `tests/proxy.mjs` verify the app and proxy separately. Live API tests do not prove browser rendering or browser-specific cookie persistence.
