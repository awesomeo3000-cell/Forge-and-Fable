# Forge & Fable — Round 13: SQLite Vault + Cookie Auth (the hosting gate)

**Audience:** Codex 5.5 in a fresh session.
**Repo root:** `E:\forge-and-fable`
**Risk level: highest of any round so far.** This migrates user data and changes the auth transport. Work in the exact task order below; each task has a hard gate before the next. If anything surprises you, stop and record it in the changelog rather than improvising — a wrong guess here loses people's characters.
**Read first:** `docs/ROADMAP-1.0.md` §0 (process + landmine list). Companion: `docs/CHANGES-10-12-review.md` for the current state.

## 0. Context

- Storage today: `data/forge-vault.json` — one JSON file, read-modify-write on every request via `src/lib/vaultStore.ts`. Known lost-update race under concurrent PUTs (documented landmine; reproduced as recently as R12 testing).
- Auth today: JWT (jose, 30d) returned in the login/register response body, stored in `localStorage`, sent as `Authorization: Bearer` by `authHeaders()` in `ForgeAndFableApp.tsx`. Server side: `authenticateRequest()` in `src/lib/auth.ts`.
- Environment: **Node v24 — `node:sqlite` (`DatabaseSync`) is available and verified working.** Use it. No new npm dependencies. (It emits an ExperimentalWarning at startup; that's acceptable and worth a one-line note in the changelog. Only if `node:sqlite` proves genuinely unusable inside Next route handlers may you fall back to `better-sqlite3` — and if so, say why in the changelog.)
- All API routes already declare `runtime = "nodejs"`.

## Task 0 — Safety net (gate: nothing proceeds without this)

1. `git add -A && git commit` the current working tree (message: `pre-R13 checkpoint`).
2. Copy `data/forge-vault.json` to `data/forge-vault.pre-r13-backup.json` (this file must still exist, untouched, at the end of the round).
3. Confirm `data/` is gitignored (it is; verify, don't assume).

## Task 1 — SQLite storage behind the existing vaultStore API

**The contract: `src/lib/vaultStore.ts` keeps its exact exported function signatures** (`registerUser`, `loginUser`, `listCharacters`, `createCharacter`, `getCharacter`, `updateCharacter`, `deleteCharacter`, `deleteUserById`). Route files must not change in this task. Validation stays in `validateCharacter.ts` — the DB does NOT become a second schema authority.

New module `src/lib/db.ts`:

- Opens `data/forge.db` with `DatabaseSync` (create `data/` if missing). Singleton via a module-level instance (Next dev hot-reload can re-evaluate modules — guard with `globalThis.__forgeDb ??= open()` so dev doesn't leak handles).
- Pragmas on open: `journal_mode = WAL`, `busy_timeout = 5000`, `foreign_keys = ON`.
- Schema (created with `CREATE TABLE IF NOT EXISTS`):

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,            -- the full character JSON, exactly as today
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
```

Characters stay a JSON blob in `data` (with `id`/`userId`/`createdAt` duplicated into columns from the blob). Do NOT normalize character fields into columns — `validateCharacter.ts` remains the schema authority and migration stays trivial.

`vaultStore.ts` reimplemented over `db.ts`:

- Reads: straightforward SELECTs; parse `data` JSON; return the same shapes as today (including `publicUser` mapping).
- `updateCharacter`: **this is the race fix — do the read-merge-write inside one transaction** (`db.exec("BEGIN IMMEDIATE")` … SELECT, merge patch over parsed JSON exactly as today (id/userId/createdAt immutable), UPDATE with new JSON + `updated_at` … COMMIT; ROLLBACK on throw). Same for `createCharacter` (existence check + insert) and `registerUser` (email-uniqueness now enforced by the UNIQUE constraint — catch the constraint violation and rethrow the existing "That email already has a vault." message so the API contract is unchanged).
- `listCharacters` keeps the current sort (createdAt descending).

**One-time migration** (inside `db.ts` open path, after schema creation, in a single transaction):
- If the `users` table is empty AND `data/forge-vault.json` exists: import every user and character from it, then rename the file to `data/forge-vault.migrated-<ISO-timestamp>.json` (rename, never delete). `console.log` the imported counts.
- If the vault JSON is corrupt, abort the migration with a clear thrown error — do NOT start with an empty DB while a vault file exists (that would look like total data loss to the user).

**Gate for Task 1** (all verified in the running app and recorded):
- Fresh boot migrates: log shows correct user/character counts; the `.migrated-*` file exists; login with an existing account shows all existing characters, sheets fully intact (spot-check one complex character: effects, pages, equipment, skins all present).
- CRUD walk: create a character, edit HP, delete a character — all persist across server restart.
- **Race test:** two browser tabs on the same character; tab A sets HP, within ~1s tab B toggles an effect; reload — BOTH changes persisted (this exact scenario loses one write on the JSON vault).
- `npm run build` + lint clean. `next build` must not complain about `node:sqlite` (if it does, add it to `serverExternalPackages` in `next.config.ts` and note it).

## Task 2 — httpOnly cookie sessions

Replace localStorage-token auth with an httpOnly cookie. JWT itself (jose, signing, 30d) is unchanged — only the transport moves.

Server:
- Login + register routes: on success, set the JWT via `Set-Cookie`: name `ff_session`, `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`, plus `Secure` when `process.env.NODE_ENV === "production"`. Response body: return `{ user }` only — the token no longer appears in any response body.
- New `POST /api/auth/logout`: clears the cookie (Max-Age=0). No auth required to call it.
- `authenticateRequest()` in `src/lib/auth.ts`: read the token from the `Cookie` header (parse `ff_session`; a tiny manual parse is fine). **Transition support:** if no cookie, fall back to the existing `Authorization: Bearer` header for this release (lets an open tab keep working mid-deploy); note in the changelog that the fallback can be removed in a later round.
- CSRF stance (document, don't build): all mutating routes are same-origin JSON `fetch`es and `SameSite=Lax` blocks cross-site POSTs; acceptable for a private deployment. One sentence in DEPLOYMENT.md.

Client (`ForgeAndFableApp.tsx` + `AuthScreen` flow):
- Remove all reads/writes of `forge-and-fable-token`. Keep `forge-and-fable-user` in localStorage purely as a display-state cache (name in the header) — it is no longer trusted for anything.
- `authHeaders()` shrinks to `Content-Type` only; cookies ride along automatically (same-origin fetch). Verify no `credentials` option is needed (same-origin default is `same-origin` — it is).
- Logout button calls `/api/auth/logout` then clears local state (existing `logOut()` function).
- The 401→logout flow (fetch, create, update, delete call sites) stays exactly as is — it now catches expired/missing cookies.
- On app load with a stored user but no valid cookie, the characters fetch will 401 and bounce to login — that's the intended re-auth path for existing users after this deploy. Note it in the changelog as a one-time "everyone logs in again."

**Gate for Task 2:**
- Login via UI → inspect the cookie in devtools/evals: `HttpOnly` true, `SameSite=Lax`, correct Max-Age; `document.cookie` does NOT expose `ff_session`; localStorage contains no token.
- Full session walk: login → sheet loads → edit persists → hard reload keeps session → logout → protected fetch 401s → login again works.
- Register path sets the cookie the same way (and its rollback-on-signing-failure from R10 still holds).
- Bearer fallback: a request with a valid `Authorization` header and no cookie still authenticates (curl test).

## Task 3 — Registration gate + password floor

- `MIN_PASSWORD_LENGTH` 8 → 10 (`src/lib/constants.ts`; the message string self-updates).
- Optional invite code: if env `REGISTRATION_CODE` is set (non-empty), `/api/auth/register` requires body field `inviteCode` to strictly equal it; wrong/missing → 403 `{"error":"Registration requires a valid invite code."}`. If the env is unset, behavior is exactly today's. AuthScreen: add an "Invite code" field on the register form (always visible, marked optional) that passes through.
- Rate limits (register + login) from R10 remain untouched.

**Gate:** with `REGISTRATION_CODE=secret` set: register without code → 403; with wrong code → 403; with right code → account created + cookie set. With env unset: register works with no code. 9-char password rejected, 10-char accepted.

## Task 4 — Docs

Update `docs/DEPLOYMENT.md`: env vars table (`JWT_SECRET` required, `REGISTRATION_CODE` optional), persistent-storage note now says **`data/forge.db` (plus `-wal`/`-shm` sidecars) must live on a persistent volume**, backup guidance = copy `forge.db` while the app is stopped (or use SQLite `.backup`), the CSRF sentence from Task 2, and the one-time re-login note for existing users.

## Hard constraints

1. No new npm dependencies (see the `node:sqlite` escape hatch above — last resort only, with justification).
2. `validateCharacter.ts`, all `src/components/**`, and the character API route shapes are untouched except the explicitly listed client auth changes in `ForgeAndFableApp.tsx`.
3. Never delete or overwrite `data/forge-vault.json` — rename on successful migration only. The Task 0 backup must survive the round.
4. All the roadmap §0 landmines apply; the JSON.stringify/`undefined` rule matters again in `updateCharacter`'s merge (the merge semantics must be byte-identical to today's: patch keys overwrite, `null` overwrites, absent keys keep old values).

## Verification & deliverable

Everything above's gates, PLUS a final regression walk (login → build a quickbuild character → roll dice → apply a skin → level up → logout/login → all state intact) at desktop width. `docs/CHANGES-13.md` with per-task entries (what changed, what you clicked/curled, what you observed), the migration log output pasted in, deviations called out explicitly. No entry = not done. If any gate fails and you can't resolve it cleanly, STOP at that gate, document precisely where, and leave the working tree buildable (the pre-R13 commit is the rollback point).
