# Deploying Forge & Fable Privately

Forge & Fable is a Next.js server app. It needs a Node web service, environment variables, and persistent storage for the vault file.

Do not deploy this to GitHub Pages or a static-only host.

## Privacy Model

Use these layers:

1. Keep the GitHub repository private.
2. Share the hosted URL only with the people you want using the app.
3. Keep normal app login enabled.

Registration only asks for email and password. Anyone with the live URL can create an account unless the host adds an outer access-control layer.

## Required Environment Variables

| Name | Purpose |
| --- | --- |
| `JWT_SECRET` | Required in production. Use a long random value. |
| `FORGE_VAULT_DIR` | Optional. Directory that stores `forge-vault.json`. Use a persistent disk path online. |

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
- `FORGE_VAULT_DIR=/var/data`

The app writes the vault to:

```text
/var/data/forge-vault.json
```

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

Railway automatically exposes the volume path as `RAILWAY_VOLUME_MOUNT_PATH`, and Forge & Fable will use it for the vault. You can also explicitly set:

```text
FORGE_VAULT_DIR=/data
```

## Local Check Before Deploying

```bash
npm run lint
npm run build
```

## Sharing With Friends

After deployment:

1. Open the hosted URL.
2. Create your own account with an email and password.
3. Share the URL privately with friends.
