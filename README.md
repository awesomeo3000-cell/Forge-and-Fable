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

## Run

```bash
npm install
npm run dev
```

The app is currently running locally at:

```text
http://127.0.0.1:3001
```

## Local Data

Vault users and characters are stored in:

```text
data/forge-vault.json
```

Passwords are hashed with `bcryptjs`. This is a local prototype data layer, so it does not require a separate database service.
The `data/` folder is intentionally ignored by Git so local users, characters, and test accounts are not published.

## Checks

```bash
npm run lint
npm run build
```
