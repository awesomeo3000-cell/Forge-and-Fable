# Publishing Forge & Fable

This folder is a Git repository for the Forge & Fable web app.

## Recommended: GitHub Desktop

1. Open GitHub Desktop.
2. Choose `File` -> `Add local repository...`.
3. Select this folder:

   ```text
   C:\Users\clare\Documents\Codex\2026-06-24\files-mentioned-by-the-user-final\outputs\forge-and-fable
   ```

4. In GitHub Desktop, choose `Publish repository`.
5. Keep it private unless you intentionally want it public.
6. Suggested repository name:

   ```text
   forge-and-fable
   ```

## What Is Not Published

The following local-only files are ignored:

- `data/` local users, characters, and test accounts
- `dev-server.log` local development server output
- `.env*` local secrets and environment values
- `.next/` generated build files
- `node_modules/` installed dependencies

## Checks

Before publishing or deploying:

```bash
npm run lint
npm run build
```

The repo also includes a GitHub Actions workflow that runs lint and build on pushes and pull requests to `main`.
