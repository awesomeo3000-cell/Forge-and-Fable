# CHANGES-32 — admin console (feedback inbox, invite codes, overview)

Adds an env-configured admin role and a ledger-styled admin console. Owner
decisions: admin via `ADMIN_EMAILS` env; admin sees all feedback (users still
see their own); capabilities = feedback inbox, invite codes, users/campaigns
overview.

## Security model
Admin identity is **env-only** (`ADMIN_EMAILS`, comma-separated,
case-insensitive) — never a DB flag, so it can't be granted by any in-app
action, survives DB resets, and needs no bootstrap. `PublicUser.isAdmin` is a
UI hint only; **every admin route re-derives admin status server-side** from the
authenticated user's stored email via `requireAdmin`. Deny-by-default: with no
`ADMIN_EMAILS` set, nobody is admin.

## Server
- `src/lib/adminEmail.ts` — pure `adminEmails()` / `isAdminEmail()` (no imports;
  avoids a vaultStore↔admin cycle).
- `src/lib/admin.ts` — `requireAdmin(request)` guard (401 unauth / 403 non-admin).
- `src/lib/vaultStore.ts` — `getUserById`, `listAllFeedback`; `publicUser()` now
  stamps `isAdmin`.
- `src/lib/adminStore.ts` — invite-code CRUD (`invite_codes` table, migration 12),
  `consumeRegistrationCode` (atomic use increment; honors legacy env
  `REGISTRATION_CODE`), `registrationRequiresCode`, `adminOverview`.
- Routes: `GET /api/admin/feedback`, `GET|POST /api/admin/invites`,
  `DELETE /api/admin/invites/[code]`, `GET /api/admin/overview` — all `requireAdmin`.
- `register` route now gates on `registrationRequiresCode()` and accepts either
  the env code or a live DB invite (additive — ungated instances still open).
- DB: `SCHEMA_REVISION` 11→12, `invite_codes` table + migration record.

## Client
- `AdminPanel.tsx` — ledger modal, tabs Feedback / Invite codes / Overview
  (create/copy/revoke codes, totals, users with admin tags + character counts,
  campaigns). Top-bar shield button rendered only when `user.isAdmin`.

## Verification
- `npm test` 173/173 (new `tests/admin.test.ts`: 9 — env identity case-handling,
  invite create/consume/exhaust/revoke, registration gating, overview shape).
  Bumped two schema-version assertions 11→12.
- `npm run typecheck` / `lint:ci` / `build` clean.
- Live security check (curl): all three admin GETs return **401**
  unauthenticated; a logged-in non-admin (no `ADMIN_EMAILS`) gets **403
  "Administrator access required."** Deny-by-default confirmed. (Test user
  removed from the DB afterward.)

## Owner setup — REQUIRED to become admin
Set `ADMIN_EMAILS` in the server environment to the email you register with,
then restart. Two places:
1. **Local (`.claude/launch.json`)**: add `set ADMIN_EMAILS=you@email.com&&`
   before the `npm ... start` command (next to `JWT_SECRET`).
2. **Hosted (Railway/Render)**: add an `ADMIN_EMAILS` env var.
Log out/in after setting it so the fresh session carries `isAdmin`. The shield
icon then appears in the top bar. Multiple admins = comma-separate.
