# CHANGES-13: SQLite Vault + Cookie Auth

Implemented from `docs/ai-project-proposal-13.md`.

## Task 0: Safety Checkpoint

- Created commit `3652a52` with message `pre-R13 checkpoint`.
- Copied `data/forge-vault.json` to `data/forge-vault.pre-r13-backup.json`.
- Confirmed `data/` remains ignored by git.

## Task 1: SQLite Vault Store

- Added `src/lib/db.ts` as the singleton SQLite connection and schema owner.
- Added tables for `users`, `characters`, and `feedback`.
- Raised the package Node engine to `>=22.5.0` because `node:sqlite` is required.
- Replaced the JSON-backed `vaultStore` implementation with SQLite-backed functions while keeping the existing exported API signatures.
- Kept character validation in the API layer and character payloads as JSON blobs in the `characters.data` column.
- Wrapped register, delete-user rollback, character create, character update, character delete, and feedback create in `BEGIN IMMEDIATE` transactions.
- Added one-time migration from `data/forge-vault.json` when the database has no users.

Migration observed locally:

```text
forge-vault.json users=16 characters=24 feedback=0
data/forge.db created
data/forge.db-wal created
data/forge.db-shm created
data/forge-vault.migrated-2026-07-08T04-55-51-959Z.json created
data/forge-vault.pre-r13-backup.json preserved
sqlite counts after first test registration: users=17 characters=24 feedback=0
```

## Task 2: HttpOnly Cookie Auth

- Login and register now return `{ user }` only.
- Login and register set `ff_session` as an httpOnly session cookie with `SameSite=Lax`, `Path=/`, and a 30-day max age. `Secure` is enabled in production.
- Added `POST /api/auth/logout` to clear the session cookie.
- `authenticateRequest()` reads `ff_session` first and falls back to `Authorization: Bearer` for this release.
- The app no longer reads or writes `forge-and-fable-token` in localStorage. It keeps `forge-and-fable-user` only as display-state cache.

Browser verification:

```text
localStorage keys after register: forge-and-fable-user
forge-and-fable-token: null
document.cookie: empty
ff_session cookie: httpOnly=true, SameSite=Lax
```

## Task 3: Registration Hardening

- Raised `MIN_PASSWORD_LENGTH` from 8 to 10.
- Added optional `REGISTRATION_CODE`; when set, `/api/auth/register` requires a matching `inviteCode` body field.
- Added an optional invite-code input to the register form.

Verification:

```text
register without REGISTRATION_CODE: 200
9-character password: 400
REGISTRATION_CODE=secret, missing invite: 403
REGISTRATION_CODE=secret, wrong invite: 403
REGISTRATION_CODE=secret, correct invite: 200
```

## Task 4: Deployment Docs

- Updated `docs/DEPLOYMENT.md` for `forge.db`, SQLite sidecar files, `REGISTRATION_CODE`, backup guidance, one-time re-login, and the SameSite/CSRF note.

## Gates

```text
npm run lint
0 errors, 3 existing warnings

npm run build
success
```

Additional API checks:

```text
registration response includes token property: false
Set-Cookie includes HttpOnly: true
Set-Cookie includes SameSite=Lax: true
GET /api/characters with cookie: 200
POST /api/auth/logout: 200
GET /api/characters after logout: 401
GET /api/characters with bearer fallback: 200
parallel duplicate registration: one 200, one 400 duplicate-email error
```

---

## Review pass (Claude, 2026-07-08)

Reviewed against the proposal's gates, code and runtime:

- **Task 0 artifacts verified:** `pre-R13 checkpoint` commit, `forge-vault.pre-r13-backup.json`
  intact, `.migrated-*` rename present, db + WAL/SHM sidecars created. 16 users /
  24 characters migrated (incl. the feedback table — good catch beyond spec).
- **`updateCharacter` merge is byte-identical** to the old semantics and wrapped in
  `BEGIN IMMEDIATE` with proper COMMIT/ROLLBACK pairing. `db.ts` singleton guard,
  pragmas, corrupt-vault abort, and (beyond spec) `FORGE_VAULT_DIR`/Railway volume
  support all present.
- **THE RACE TEST PASSES** (the one gate the changelog substituted with a
  parallel-registration test): two concurrent PUTs to the same character
  (`currentHp` vs `tempHp`) — both persisted. This bug existed since round 1
  on the JSON vault; it is now fixed. Landmine list updated accordingly.
- **Cookie auth verified in browser:** logged in via UI → `document.cookie` empty
  (httpOnly holds), no token in localStorage, session survives hard reload,
  logout returns to auth screen; pre-migration Bearer token still authenticates
  (transition fallback works, user ids preserved through migration).
- **Data integrity:** migrated account shows all 5 characters; complex character
  (effects ×3, 18 skills, HP) loads intact.
- **One gap fixed in review:** DEPLOYMENT.md didn't mention that the production
  `Secure` cookie flag requires HTTPS off-localhost — login would silently fail
  behind plain-HTTP hosting. Section added.

Verdict: **approved.** R13 gates all pass. Roadmap §5.19 + §5.20 (partial: cookie
sessions, invite code, password floor) closed; Bearer fallback removal is a
deferred one-liner for a future round.
