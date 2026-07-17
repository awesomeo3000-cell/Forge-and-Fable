# Dreamwright

Dreamwright is a local Next.js 16 character builder and play console inspired by a cinematic RPG HUD. It includes vault login/register, a five-step D&D 5e-style character wizard, point-buy/standard-array/rolled stats, live ability and HP calculations, a dice tray, spell and inventory tabs, and a small command console.

## Environment

Authentication uses JWT tokens signed with a secret. Set the `JWT_SECRET` environment variable before running:

```bash
# PowerShell
$env:JWT_SECRET="your-secret-here"
# or cmd
set JWT_SECRET=your-secret-here
```

For a hosted friends-only deployment, set `FORGE_VAULT_DIR` to a persistent disk path so users and characters survive deploys and restarts. Registration is intentionally simple: email and password only.

## Run

```bash
npm install
npm run dev
```

The app is currently running locally at:

```text
http://127.0.0.1:3000
```

## Local Data

Vault users, characters, campaigns, and feedback are stored in SQLite at:

```text
data/forge.db
```

Passwords are hashed with `bcryptjs`. SQLite runs locally with WAL mode, so the app does not require a separate database service for a single-instance deployment.
The `data/` folder is intentionally ignored by Git so local users, characters, and test accounts are not published.

Set `FORGE_VAULT_DIR` to change this location, for example `/var/data` on Render or `/data` on Railway.

For disaster recovery, set `FORGE_BACKUP_DIR` to a different persistent volume or a mounted backup destination. Keeping backups under the vault directory is useful for quick rollback, but does not protect against loss of that volume.

## Deployment

See `docs/DEPLOYMENT.md` for Render and Railway setup. The repo includes `render.yaml` and `railway.json`.

## Checks

```bash
npm run lint
npm test
npm run typecheck
npm run build
```
