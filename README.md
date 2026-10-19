# CAMPUS360 v1.0 — VS Code source export

Aditya College of Engineering and Technology · college issue reporting, confidential reporter identities and admin-led resolution.

This folder contains the complete official project source, backend APIs, Supabase functions/SQL, Cloudflare deployment configuration, campus image, local intelligence, tests and a separate static demo. `EXPORT_INFO.json` records the original source commit. Export-only convenience scripts do not change the hosted website.

## 1. Open in VS Code

Unzip `CAMPUS360_Source.zip`. Open the extracted **CAMPUS360** folder using VS Code → File → Open Folder, or open `CAMPUS360.code-workspace`.

Use Node.js **22.13 or newer** and the project’s pinned **pnpm 11.25.0**. The package manager downloads dependencies; `node_modules` is intentionally not included.

From VS Code’s terminal, inside this folder:

```bash
npx --yes pnpm@11.25.0 install --frozen-lockfile
node scripts/setup-local.mjs
```

Edit the ignored `.dev.vars` file locally. `SUPABASE_PORTAL_URL` is already set to the existing backend. Fill `SUPABASE_GATEWAY_TOKEN` only from your securely held gateway credential. Do not put the Supabase service-role key here. A missing or mismatched gateway token prevents live login/API access.

```bash
npx --yes pnpm@11.25.0 dev
```

Open `http://localhost:5173`. This project uses **Vinext/Vite with Cloudflare Workers APIs**; it is not a plain Next.js Node server. Use the provided commands. Do not replace them with `next dev`.

The local shell can build without production secrets, but authentication and data access require a configured backend. The copy does not contain a working plaintext gateway credential. Do not rotate a production credential just to try the UI.

## 2. What is in the folder

| Path | Contents |
|---|---|
| `app/` | Student, staff and admin UI, login/activation, roster invitations, charts and audit history |
| `app/api/portal/route.ts` | Same-origin API gateway, cookie filtering and origin checks |
| `lib/` | Local AI classifier/retrieval, privacy checks, chart calculations, session helpers and shared code |
| `supabase/functions/campus-portal/` | Full Supabase Edge API source and Deno configuration |
| `supabase/schema/` | SQL definitions and phased updates for tables, permissions, encryption, activation and recovery |
| `scripts/prepare-workers-export.mjs` | Creates the standalone Cloudflare configuration and wrapper |
| `dist/cloudflare/` | Ready-built Cloudflare Worker wrapper and Wrangler config |
| `dist/server/`, `dist/client/` | Tested build output for the official source snapshot |
| `build/`, `vite.config.ts` | Maintained build integration and Worker entrypoints |
| `public/` | Icons and college campus photo |
| `tests/` | Local tests, SQL tests and opt-in live integration scripts |
| `docs/` | Security, encryption, invitation, AI, Cloudflare and export notes |
| `demo/` | Separate static AI/dashboard demo, using sample data |
| `package.json`, `pnpm-lock.yaml` | Dependency and script definitions with the original lockfile |

`db/`, `drizzle/`, `examples/d1/` and older D1 tests are preserved historical starter/migration code. The active backend uses Supabase; these old files are not the source of current student data.

## 3. Run local checks

```bash
npx --yes pnpm@11.25.0 test:local
npx --yes pnpm@11.25.0 exec tsc --noEmit
```

`test:local` runs the safe local logic and mocked backend checks. The `*-live.py` and SQL tests are separate: read them before using them against any database. They can create temporary fixtures or exercise real backend operations. Do not run live test scripts just to open the website.

## 4. Build and deploy to your existing Cloudflare Worker

Build after modifying source:

```bash
npx --yes pnpm@11.25.0 build:cloudflare
```

This creates `dist/cloudflare/wrangler.json`, retaining the Worker name `campus360`, the existing account ID, static assets and dedicated gateway connection. Review these values before deploying to another account.

Log in from your own computer:

```bash
npx --yes wrangler@4.151.1 login
npx --yes wrangler@4.151.1 whoami
```

Then deploy:

```bash
npx --yes wrangler@4.151.1 deploy --config dist/cloudflare/wrangler.json
```

The existing Worker already has its encrypted `SUPABASE_GATEWAY_TOKEN` configured. A normal redeploy keeps that secret; no new secret is needed. Run the build before deployment. The two generated `vinext-server.json` files are included at the owner’s explicit request after verifying this repository is private. They contain per-build secrets. Rebuild before deployment to generate fresh values, and remove these files before making the repository public.

The direct Worker wrapper strips visitor-supplied ChatGPT identity/provisioning headers. Do not add `OWNER_EMAIL` or `ACCOUNT_PROVISION_TOKEN` to direct Cloudflare hosting. No D1/R2 resource is required for the active application.

The last Cloudflare deployment predates later UI/AI changes. In the original editing environment, Cloudflare OAuth completion was blocked and Wrangler reported unauthenticated. This ZIP contains the newer source/build; it does not mean those changes have already reached the workers.dev address. Log in on your computer and deploy if you want to update it.

Deployment address: `https://campus360.studentvoice.workers.dev`.

## 5. Supabase backend

Existing project: `amtjrfkwbwsihhjzhorv`.

The existing backend remains hosted in Supabase. You do not need to recreate or reset it to edit the frontend. Credentials, Auth users, reports, uploaded evidence, Vault keys and database contents are not in this export.

The Edge Function source is `supabase/functions/campus-portal/index.ts`; the current backend uses custom authenticated gateway checks and intentionally has `verify_jwt` disabled. Preserve that authentication design when deploying updates. Platform-managed service credentials belong only in the Supabase function environment, never in browser code.

The SQL directory contains the project's historical/phased updates. They are **not an automatically ordered clean-room migration bundle**. Some statements are one-time, some require existing state, and encryption is phased around a matching backend deployment. Do not execute all SQL files against the live project. For a fresh database, reconcile the hosted schema/migration history, use an isolated project, configure Storage/Vault/credentials, and validate permissions before importing real records. Read `docs/EXPORT_DATABASE_NOTES.md`.

## 6. Built-in AI and analytics

No third-party inference API or pretrained model is required. The in-house model uses 90 fictional examples and local Naive Bayes classification. Similarity uses TF-IDF/cosine matching on open campus-visible reports. Writing uses templates; privacy checks use limited text patterns; admin summaries extract source sentences.

Tests are not proof of real-world accuracy. The 34 synthetic development cases were used during development and are not a blind benchmark. Attachments are not scanned, Kannada/Hindi understanding is not implemented, and admins still decide resolutions.

Audit graphs show the latest 100 loaded records, not the entire historical audit database. Date aggregation uses India time.

## 7. Separate demo

`demo/` is a self-contained static demo with sample reports. In another terminal:

```bash
python3 -m http.server 8000 --directory demo
```

Open `http://localhost:8000`. Use HTTP; module imports may not work by double-clicking `index.html` under a file URL. The demo’s local assistance predates the latest production classifier, and it has no real database connection.

## 8. Included and excluded

Included: all tracked code from the official snapshot, the campus asset, frontend/server build assets, including the explicitly approved private-repository generated configuration, public service addresses and deployment identifiers, dependency lockfile, tests, documentation and the static demo.

Excluded: `.git`, `node_modules`, actual environment files, cookies, OAuth tokens, API/service secrets, production gateway plaintext, account passwords, user database records, evidence uploads and Vault encryption keys. Some test files contain clearly synthetic fixture values; they are not production credentials.

The original hosting manifest is retained for traceability. Local commands do not publish to Sites or change its access settings. Database authentication and encryption remain on the backend.

GitHub import note: the two generated secret-bearing configuration files were added after explicit owner approval for this private repository. API keys, gateway credentials, passwords and database records are still excluded. Run `pnpm build:cloudflare` before deploying.

Verified for this export: file inventory, archive integrity, secret-pattern checks, local test suite, TypeScript and build. macOS/Safari end-to-end use has not been verified here.


## Encrypted application-data backup

The 2026-10-19 snapshot contains 202 records across all 12 CAMPUS360 application tables plus schema metadata. See [backup scope and recovery instructions](backups/README.md). The encrypted export and manifest are committed under `backups/2026-10-19T165537Z/`; the recovery key is delivered separately and is not in GitHub. Managed Auth records, Vault keys, uploaded evidence bytes and runtime secrets require separate recovery arrangements.
