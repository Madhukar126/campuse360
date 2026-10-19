# CAMPUS360 encrypted application-data backup

Snapshot: **2026-10-19 16:55:37 UTC**, project `amtjrfkwbwsihhjzhorv`.

The [encrypted export](2026-10-19T165537Z/application-data.enc.json) contains all **202 records in the 12 `public.c360_*` application tables** at the snapshot time. A single read-only SQL statement captured the rows consistently. It also includes current column/constraint/index metadata, RLS settings, policies, triggers, function definitions/ACLs and extension versions. See [manifest.json](2026-10-19T165537Z/manifest.json) for counts, checksums, exclusions and verification results.

The original names, USNs and audit fields remain encrypted as stored in Postgres. The entire export is additionally gzip-compressed and encrypted with AES-256-GCM, using a random 256-bit key and 96-bit nonce. Header metadata is authenticated. The recovery key is delivered separately and is **not in this repository**.

## Verify or decrypt locally

Use Python 3.10+ and keep the recovery key file outside your checkout. The dependency version below was used to create and verify this snapshot.

```sh
python -m pip install -r backups/requirements.txt

# Verifies authenticated decryption and row counts without writing plaintext.
python backups/decrypt_backup.py backups/2026-10-19T165537Z/application-data.enc.json --key-file /private/CAMPUS360_Recovery_Key_20261019T165537Z.json

# Optional: save sensitive JSON outside your repository.
python backups/decrypt_backup.py backups/2026-10-19T165537Z/application-data.enc.json --key-file /private/CAMPUS360_Recovery_Key_20261019T165537Z.json --output /private/campus360.decrypted.json
```

Replace `/private/` with your own private folder. The script refuses to overwrite an existing output. It verifies the encrypted-file checksum pinned in the key file, AES-GCM authentication, the decrypted payload checksum and every table's row count. It never connects to a database.

## Recovery scope and limits

This is an application-record export, **not a full Supabase project backup or an installable SQL dump**. The snapshot does not include:

- Supabase Auth records, password hashes or identities. The 17 application account rows still refer to the corresponding Auth users.
- Vault secret values, including the existing field-encryption and lookup keys. The separate recovery key only opens this backup envelope; it cannot decrypt those original fields.
- Uploaded evidence bytes or the managed Storage schema. The five attachment records reference files that must still exist or be restored separately.
- Edge Function runtime secrets, Cloudflare secrets, service/API keys or account configuration.
- Other Supabase-managed/internal schemas.

For selective recovery, decrypt into a private local folder, compare the relevant records with a test copy of the **matching existing schema**, and import only reviewed records using parameterized SQL in a transaction. Existing Auth identities, Vault keys and Storage objects must be retained or recovered separately. The historical SQL files elsewhere in this repository are not a clean installation migration bundle; the schema metadata in this export is for review rather than automatic execution.

The export includes the stored session, gateway, invitation, recovery and rate-limit hashes because these are application tables. They are not plaintext credentials. Review security state during recovery; do not blindly replay sessions or overwrite newer gateway/account security settings.

Before any database import, compare schema, Auth references, foreign keys, encryption behavior and RLS/grants in a disposable environment. No database import or live restore test was performed for this export. Production data was not modified.

For full disaster recovery, create a supported Supabase database dump and independently back up Storage objects, field-encryption keys and service configuration. Supabase's [database backup documentation](https://supabase.com/docs/guides/platform/backups) and [CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) describe the broader process.

## Verification performed

- Source payload length and checksum matched the database export.
- All 12 table row counts matched the exported arrays.
- Encryption/decryption round trip reproduced the exact source bytes.
- Wrong keys and tampered ciphertext were rejected.
- The recovery key was kept outside the GitHub upload paths.

Keep the recovery key with your private backups. Losing it makes this encrypted export inaccessible.
