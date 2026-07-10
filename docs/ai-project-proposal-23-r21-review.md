# Proposal 23 — the R21 review gate: verify the hardening round

**Implementer:** Codex tier (or whoever ran CHANGES-20/21 — the work was excellent; this round closes its own admitted gap).
**Scope:** verification + two small alignment fixes. This is NOT a feature round — if you find yourself redesigning something, stop and file it in the changelog instead.
**Read first:** `docs/CHANGES-21.md` (its Verification section ends with "recorded after the full review gate below is completed" — and records nothing; this proposal IS that gate), `docs/CHANGES-20.md`, `docs/ROADMAP-1.0.md` §0 landmines + §7 release gate.

## Why

CHANGES-21 landed the most consequential infrastructure since SQLite: character revisions with `If-Match` (428 missing / 409 stale + server copy), a client save coordinator with optimistic rebasing, retroactive CON/Tough HP, schema migrations with a ledger, `/api/health`, `db:backup`, and deploy fixes. None of it has recorded verification. Concurrency and migration code is exactly the code whose bugs are invisible until they eat data at the table. Completing this gate also completes the §7 release-gate item "two-browser concurrency smoke test" — after this round, only human-scale items (manual pass, licensing, README) separate the project from 1.0.

## Hard rules

1. **Never run destructive tests against the live `data/forge.db`.** Copy it (`npm run db:backup`, or file-copy while the server is stopped) and run migration/restore drills against the copy. If a test would write junk characters, use the throwaway review account below and delete them after.
2. The server is `next start` — **rebuild + restart before any browser/API verification**, and again after each fix.
3. Test account with fixtures: `player-two-review@example.com` / `player-two-pass1` (characters incl. Pip, AuditBard, AuditArtificer, AuditWizard). A second account can be registered freely. API testing: cookie jars (`curl -c jar.txt` on login, `-b jar.txt` after).
4. Re-anchor every code reference by grep before acting — this repo moves daily; nothing in this document is guaranteed to be at the line it was yesterday.
5. Record everything in `docs/CHANGES-23.md` AND append a completed "Verification" section to `docs/CHANGES-21.md` (replacing its placeholder sentence). Honest results only — a FAILED expectation recorded is a pass for this round; a fabricated PASS is how this project has been burned before.

## Part A — adversarial verification

### A1. Revision conflicts (two sessions, same character)
Two cookie-jar sessions (or one jar + the browser) editing ONE character:
1. Session 1 `GET /api/characters` → note the character's `revision`.
2. Session 2 PUT a patch with correct `If-Match` → expect 200, revision advances.
3. Session 1 PUT with the now-stale revision → **expect 409 with the current server character in the body** (per CHANGES-21). Record status + body shape.
4. PUT with NO `If-Match` → **expect 428**.
5. In the browser: two tabs, same character; edit HP in tab A, then a different field in tab B (which holds a stale copy) → expect tab B's save coordinator to rebase and land BOTH edits; verify final DB state contains both. Record what the UI showed during the conflict.

### A2. Campaign push × revision race (the R16/R21 seam)
The DM condition push is applied by the PLAYER's client through `updateCharacterById` → save coordinator. Race it:
1. Player session editing their character continuously (e.g. HP steppers).
2. DM session pushes a condition (`POST /api/campaigns/:id/events`, type `condition-apply`) mid-edit.
3. Expect BOTH the player's edits and the pushed effect on the final server character — no lost update in either direction, no 409 surfaced to the user as an error. Use campaign "Review Table" (join code `EPQK9A`) or create fresh.

### A3. Migration adoption
Against a COPY of the production DB (schema rev < 3 copies exist in `public`? if no pre-migration copy survives, construct one: the migration code path can be exercised by deleting the `schema_migrations` rows in the copy — read `src/lib/db.ts` first to do this correctly):
1. Point a dev instance at the copy (data dir env/config — check how CHANGES-21 made the path configurable for Railway).
2. Boot → expect in-place adoption, `schema_migrations` populated, characters intact with `revision` column.
3. `/api/health` → expect DB access, write-lock, and schema-version checks all green; record the payload.

### A4. Backup / restore drill
1. `npm run db:backup` → confirm the backup file exists and rotation keeps ≤7.
2. Restore drill: stop server, swap the live DB for the backup copy (keep the original!), boot, log in, confirm characters load. Swap back.

### A5. Regression sweep
`npm test` (all green), `npm run typecheck`, `npm run lint:ci`, `npm run build`. Then the standing manual mini-pass: sheet renders, level-up opens (The Entry), builder threshold cards render, campaign panel opens, PDF import modal opens.

## Part B — two small alignment fixes (in scope)

### B1. Campaign initiative stale write: 400 → 409
`PUT` on campaign initiative with a stale `version` returns 400; since R16 review this was flagged as "should be 409," and R21 has now established the 409-on-stale convention for characters. Align it: return **409** (body may include the current initiative state, mirroring the character route's shape). Update the client if it matches on the status code (grep `updateCampaignInitiative` / the CampaignPanel fetch). Add/extend an integration test if the R21 test harness reaches that route.

### B2. CHANGES-21 verification section
Replace the placeholder sentence in `docs/CHANGES-21.md` with the actual recorded results from Part A (or a pointer to CHANGES-23).

## Definition of done

- Every A-item has recorded expected-vs-observed results (status codes, payloads, DB states) in CHANGES-23.
- Any FAILED expectation is written up with a reproduction — do not silently fix beyond B1/B2 scope; flag for the next round.
- B1 shipped with test coverage; full A5 sweep green afterward.
- CHANGES-21's verification placeholder is gone.
