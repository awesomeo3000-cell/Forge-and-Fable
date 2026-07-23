# CHANGES-HB-1 — Phase 1: Versioned registry, storage, and API

**Phase:** 1 (Versioned registry, storage, and API) of `docs/ai-project-proposal-homebrew-studio.md`
**Risk:** High
**Status:** Backend complete. No character integration (that is Phases 3+).

## 1. Scope completed

Owners can create, clone, save immutable versions, publish, deprecate, list,
read, compare-metadata, and archive homebrew content through authenticated API
routes — with ownership/visibility enforced in the data-access layer and
published versions immutable.

## 2. Files changed

Added:

- `src/lib/homebrew/homebrewDtos.ts` — row types + safe client DTOs (no owner id;
  no draft payloads to non-owners).
- `src/lib/homebrew/homebrewStore.ts` — the only writer; transactions,
  authorization, immutable versions, optimistic `revision`, typed errors.
- `src/lib/homebrew/routeHelpers.ts` — error→response mapping, body-size guard,
  `If-Match` parsing.
- `src/app/api/homebrew/route.ts` — `GET` list, `POST` create/clone.
- `src/app/api/homebrew/[definitionId]/route.ts` — `GET` detail, `PATCH` metadata.
- `src/app/api/homebrew/[definitionId]/versions/route.ts` — `POST` save draft.
- `src/app/api/homebrew/[definitionId]/versions/[versionId]/route.ts` — `GET`.
- `.../[versionId]/publish/route.ts`, `.../[versionId]/deprecate/route.ts` — `POST`.
- `src/app/api/homebrew/validate/route.ts` — `POST` validate unsaved payload.
- `tests/homebrewStore.integration.test.ts` (10)
- `tests/homebrewApi.integration.test.ts` (7)
- `tests/homebrewAuthorization.integration.test.ts` (6)
- `docs/CHANGES-HB-1.md` (this file).

Modified:

- `src/lib/db.ts` — `SCHEMA_REVISION` 25 → 26; added `HOMEBREW_TABLES_SQL` and
  wired it into both the base `createSchema` block (fresh installs) and a new
  idempotent migration step (`recordMigration(db, 26, …)`) before the
  `PRAGMA user_version` line.
- `tests/characterApi.integration.test.ts` — legacy-DB adoption test now expects
  `MAX(version) = 26`.

## 3. Data / schema decisions

- **Schema revision 26.** Three tables per proposal §4.4:
  `homebrew_definitions`, `homebrew_versions`, `campaign_homebrew_access`, plus
  the partial unique index `idx_homebrew_owner_slug` and supporting indexes.
- `current_version_id` / `latest_published_version_id` are plain TEXT pointers
  (not FKs) to avoid a circular definitions↔versions constraint; integrity is
  maintained transactionally in the store.
- `owner_user_id` and `created_by_user_id` are `ON DELETE SET NULL`;
  `homebrew_versions.definition_id` and `parent_version_id` are
  `ON DELETE RESTRICT`; `campaign_homebrew_access` cascades from campaign/definition.
- `content_hash` = SHA-256 of canonical (key-sorted) payload JSON, computed
  server-side.
- Slugs auto-suffix (`-2`, `-3`, …) on per-owner/kind collision; the partial
  unique index ignores archived rows.
- Save-version is explicit and immutable: each save inserts a new row with the
  next `ordinal` and repoints `current_version_id`; publishing flips status +
  sets `latest_published_version_id` and **never** rewrites `payload_json`.

## 4. Compatibility decisions

- Additive migration; no existing table or row is altered. A DB with no homebrew
  rows behaves exactly as before (invariant §3.3).
- Fresh installs and migrated installs converge on identical structure (shared
  `HOMEBREW_TABLES_SQL`).
- **Account deletion:** `deleteUserById` relies on FK cascade; with
  `owner_user_id ON DELETE SET NULL`, definitions and their published versions
  survive account deletion with a null owner (test-verified). This satisfies the
  gate "preserves referenced published versions."

## 5. Test evidence

- `npx vitest run tests/homebrewStore.integration.test.ts` → **10 passed.**
- `npx vitest run tests/homebrewApi.integration.test.ts tests/homebrewAuthorization.integration.test.ts` → **13 passed.**
- `npx vitest run tests/characterApi.integration.test.ts -t "adopts an existing database"` → **passed** (migrates to revision 26).
- `npx tsc --noEmit` → exit 0. `npx eslint --max-warnings=0` over all new/changed files → exit 0.
- Full suite (`npm test`) run to confirm no regressions.

**Phase 1 gate:**

- ✅ Alice cannot read or mutate Bob's private draft — returns 404 (no existence
  leak), and 403 for a campaign-readable-but-not-owned definition.
- ✅ A cloned baseline is a deep copy (mutating the caller's object does not
  affect stored content) and preserves provenance.
- ✅ Saving twice yields ordinals 1 and 2.
- ✅ Publishing v1 then saving v2 does not mutate v1 (status, hash, and payload
  unchanged).
- ✅ A stale definition revision receives 409 (store + HTTP), carrying the current
  revision.
- ✅ Account deletion preserves referenced published versions.

## 6. Browser / runtime evidence

None. Phase 1 ships no UI (see §7). Routes are exercised by handler-level
integration tests that build real `Request` objects and assert real responses.

## 7. Deviations from the proposal

- **Homebrew Studio library UI shell deferred.** The proposal lists an optional
  "temporary JSON-backed editor … only if type-specific forms are not ready."
  Phase 3 delivers the real Item editor next, so a throwaway JSON UI was not
  built. All backend deliverables and gate criteria (which are API/integration
  based) are met. Recommend building the library shell alongside the Phase 3
  Item editor.
- **Campaign share/revoke routes deferred to Phase 8.** The
  `campaign_homebrew_access` table exists now (needed for schema revision 26 and
  read authorization), and the store's read path already honors campaign access
  (test-verified), but the DM allow/revoke route handlers
  (`POST/DELETE /api/campaigns/[id]/homebrew`) land with campaign sharing in
  Phase 8. No Phase 1 gate item depends on them.
- Added a `428 Precondition Required` response when a mutating request omits
  `If-Match`, mirroring the existing character route's revision-header handling.

## 8. Known manual-only behavior

- No character can yet reference homebrew content; selection/pinning is Phase 3+.
- Non-owner reads only succeed for campaign-shared published versions; since the
  DM allow route is deferred, in practice only owners have content to read until
  Phase 8. The authorization is fully implemented and tested regardless.

## 9. Rollback notes

- Code: delete the added files in §2 and revert the `src/lib/db.ts` and
  `tests/characterApi.integration.test.ts` edits.
- Schema: revision 26 is additive (three new tables, no data migration). Rolling
  the app back to revision 25 while a revision-26 DB exists will fail the
  `migration.version !== SCHEMA_REVISION` guard in `db.ts`; the tables are inert
  and can be dropped if a hard rollback is required. No existing data is touched.

## 10. Next-phase blockers

None for Phase 2 (runtime resolver + mechanics engine), which builds on the
Phase 0 contracts and does not depend on the deferred UI/campaign routes. When
Phase 3 builds the Item Studio it should:

- Add the library shell + Item editor and a built-in→`HomebrewItemPayload` clone
  converter (the store already accepts a `baseline` + deep-copies).
- Route all payload validation through `validateHomebrewPayload` /
  `POST /api/homebrew/validate` rather than re-deriving rules.
