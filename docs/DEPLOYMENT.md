# Deploying Dreamwright.gg

Dreamwright is a Next.js server app. It needs a Node 22.5+ web service, environment variables, and persistent storage for the SQLite database.

Do not deploy this to GitHub Pages or a static-only host.

## Privacy Model

Use these layers:

1. Keep the GitHub repository private.
2. Share the hosted URL only with the people you want using the app.
3. Keep normal app login enabled.

Registration asks for email and password, with an optional invite code if you set one in the host environment. Anyone with the live URL can create an account when `REGISTRATION_CODE` is unset.

## Required Environment Variables

| Name | Purpose |
| --- | --- |
| `JWT_SECRET` | Required in production. Use a long random value. |
| `REGISTRATION_CODE` | Optional. If set, new accounts must enter this exact code. |
| `APP_URL` | Required canonical public URL. Production uses `https://www.dreamwright.gg`. |
| `RESEND_API_KEY` | Required send-enabled Resend API key for verification and password-reset email. |
| `FORGE_VAULT_DIR` | Optional legacy-compatible directory variable that stores `forge.db` plus SQLite sidecars. Use a persistent disk path online. |
| `FORGE_BACKUP_DIR` | Required for production backup jobs. Must be outside `FORGE_VAULT_DIR` on separate durable storage. |
| `FORGE_BACKUP_KEEP` | Number of timestamped backups to retain; defaults to 7. |
| `BACKUP_EXPORT_TOKEN` | At least 32 random characters. Authorizes only the scheduled encrypted-transport backup download endpoint. |

Generate a strong `JWT_SECRET`:

```bash
openssl rand -base64 64
```

If OpenSSL is not available, use any password manager's random generator and make a long secret.

## Render

This repo includes `render.yaml`.

1. Push this repo to a private GitHub repository.
2. In Render, choose **New** -> **Blueprint**.
3. Connect the GitHub repository.
4. Render will read `render.yaml`.
5. Deploy the blueprint.

The blueprint creates:

- a Node web service
- a generated `JWT_SECRET`
- a persistent disk mounted at `/var/data`
- `APP_URL=https://www.dreamwright.gg`
- `FORGE_VAULT_DIR=/var/data`

The app writes the vault database to:

```text
/var/data/forge.db
```

SQLite may also create `/var/data/forge.db-wal` and `/var/data/forge.db-shm`. Keep all three files on the persistent disk.

## Railway

This repo includes `railway.json`.

1. Push this repo to a private GitHub repository.
2. In Railway, create a new project from that GitHub repo.
3. Add a volume to the service.
4. Mount the volume at:

```text
/data
```

5. Set variables:

```text
JWT_SECRET=<long random secret>
```

Railway automatically exposes the volume path as `RAILWAY_VOLUME_MOUNT_PATH`, and Dreamwright will use it for the vault. You can also explicitly set:

```text
FORGE_VAULT_DIR=/data
```

Do not set `FORGE_VAULT_DIR` to a relative `data` path on Railway. That overrides the mounted-volume variable and can place the database on ephemeral application storage. The checked-in `railway.json` intentionally leaves this variable unset.

The database will live at `/data/forge.db` with possible `-wal` and `-shm` sidecars.

## Vault Migration and Backups

On first boot after this update, Dreamwright migrates the legacy `forge-vault.json` into SQLite if the database has no users yet. After a successful migration, the old JSON file is renamed to `forge-vault.migrated-<timestamp>.json`.

Create a consistent SQLite backup with:

```bash
npm run db:backup
```

Set `FORGE_BACKUP_DIR` before running it in production. The command writes timestamped databases there and retains the newest seven by default. If it is unset, backups are written under `<vault-dir>/backups/` and the command prints a warning because that location is on the same volume as the live database. It uses SQLite `VACUUM INTO`, so the resulting file is self-contained even when WAL mode is active.

Verify a backup before relying on it:

```bash
npm run db:verify-backup -- /path/to/forge-2026-07-17T12-00-00-000Z.db
```

Every backup is now verified automatically before it is retained. The separate verification command checks SQLite integrity, foreign-key consistency, and that an older backup can still be opened read-only.

Schedule the backup job on the hosting platform and alert on non-zero exits. A same-volume copy is useful for operator mistakes but is not disaster recovery; production backup commands fail when the destination is missing or nested under the vault directory. `FORGE_ALLOW_SAME_VOLUME_BACKUP=true` is an explicit emergency override, not a recommended deployment setting.

For Railway, enable scheduled volume backups in addition to the application-level export. Render automatically snapshots persistent disks daily, but its cron services cannot mount a web service's disk, so the checked-in `.github/workflows/backup.yml` performs the application-level off-volume copy instead.

Configure these repository secrets before enabling the workflow:

```text
DREAMWRIGHT_BACKUP_URL=https://www.dreamwright.gg
DREAMWRIGHT_BACKUP_TOKEN=<same value as the host's BACKUP_EXPORT_TOKEN>
```

The workflow runs daily, downloads a transactionally consistent SQLite copy over HTTPS, verifies integrity and foreign keys, exercises a writable restore copy, stores the verified database as a 30-day GitHub Actions artifact, and opens or updates a repository issue if any step fails. Manually run **Off-volume database backup** once after configuring the secrets and after every schema migration.

To restore, stop the app, preserve the current `forge.db` and its `-wal`/`-shm` sidecars, copy the chosen backup to `forge.db`, remove stale sidecars, and restart. Confirm `/api/health` returns `ok: true` before allowing edits.

Before touching production, exercise the backup in an isolated temporary directory:

```bash
npm run db:restore-drill -- /path/to/dreamwright-backup.db
```

Existing browser sessions may need to log in again after this deployment because authentication now uses an httpOnly `ff_session` cookie instead of a JWT stored in localStorage.

The session cookie uses `SameSite=Lax`, which helps protect normal cross-site form attacks. If the app later accepts cross-site embeds, third-party integrations, or state-changing GET requests, add a dedicated CSRF token flow before enabling that.

## Local Check Before Deploying

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

Both deployment descriptors use `/api/health`, which verifies that SQLite opens, accepts a write lock, and is at the expected migration level.

## Sharing With Friends

After deployment:

1. Open the hosted URL.
2. Create your own account with an email and password.
3. Share the URL privately with friends.

## HTTPS requirement (session cookie)

In production (`NODE_ENV=production`) the `ff_session` cookie is set with the
`Secure` flag: browsers will only send it over **HTTPS** (localhost is exempt).
If you host behind plain HTTP on a LAN or a reverse proxy without TLS, login
will appear to succeed but the session won't stick. Host with HTTPS (any
platform TLS terminator counts), or for a strictly-LAN toy deployment run
without `NODE_ENV=production` — accepting that you also lose the flag.
