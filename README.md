# Dreamwright.gg

[Dreamwright.gg](https://www.dreamwright.gg) is a fifth-edition character builder, character sheet, campaign workspace, and DM toolkit. It supports Standard, Quickbuilder, Premade, and PDF-import character creation; progression, spells, effects, equipment, rest, dice, and print workflows; and connected player/DM campaign sessions.

## Environment

Authentication uses JWT tokens signed with a secret. Set the `JWT_SECRET` environment variable before running:

```bash
# PowerShell
$env:JWT_SECRET="your-secret-here"
# or cmd
set JWT_SECRET=your-secret-here
```

For a hosted deployment, set `APP_URL=https://www.dreamwright.gg`, configure Resend, and place the SQLite database on persistent storage. `FORGE_VAULT_DIR` remains the legacy-compatible data-directory variable so existing installations do not lose their database after upgrading the public brand.

## Run

```bash
npm install
npm run dev
```

The development server runs locally at:

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

Set `FORGE_VAULT_DIR` to change this location, for example `/var/data` on Render or `/data` on Railway. The legacy variable and `forge.db` filename are intentionally retained for safe upgrades; neither is public product branding.

For disaster recovery, set `FORGE_BACKUP_DIR` to a different persistent volume or a mounted backup destination. Keeping backups under the vault directory is useful for quick rollback, but does not protect against loss of that volume.

## Deployment

See `docs/DEPLOYMENT.md` for Render and Railway setup. The repo includes `render.yaml` and `railway.json`.

## Public policies

- [Privacy](https://www.dreamwright.gg/privacy)
- [Terms](https://www.dreamwright.gg/terms)
- [Licensing and attributions](https://www.dreamwright.gg/legal)
- [Support](https://www.dreamwright.gg/support)

## Checks

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run release:check
npm run test:e2e
```
