# Forge & Fable

Forge & Fable is a local Next.js 16 character builder and play console inspired by a cinematic RPG HUD. It includes vault login/register, a five-step D&D 5e-style character wizard, point-buy/standard-array/rolled stats, live ability and HP calculations, a dice tray, spell and inventory tabs, and a small command console.

## Environment

Authentication uses JWT tokens signed with a secret. Set the `JWT_SECRET` environment variable before running:

```bash
# PowerShell
$env:JWT_SECRET="your-secret-here"
# or cmd
set JWT_SECRET=your-secret-here
```

For a hosted friends-only deployment, set `REGISTRATION_INVITE_CODE` so new accounts require the shared private code. You can also set `FORGE_VAULT_DIR` to a persistent disk path so users and characters survive deploys and restarts.

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

Vault users and characters are stored in:

```text
data/forge-vault.json
```

Passwords are hashed with `bcryptjs`. This is a local prototype data layer, so it does not require a separate database service.
The `data/` folder is intentionally ignored by Git so local users, characters, and test accounts are not published.

Set `FORGE_VAULT_DIR` to change this location, for example `/var/data` on Render or `/data` on Railway.

## Deployment

See `docs/DEPLOYMENT.md` for Render and Railway setup. The repo includes `render.yaml` and `railway.json`.

## Checks

```bash
npm run lint
npm run build
```
