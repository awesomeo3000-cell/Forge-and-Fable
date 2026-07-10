# Changes 21 — foundation hardening

## Outcome

This round establishes a stable base for UX polish and future character rules work. It adds ordered character persistence, shared derived-rule functions, database migrations and health checks, deployment-safe storage configuration, recovery tooling, and integration coverage.

## Character write integrity

- Characters now carry a server-managed `revision`.
- PUT `/api/characters/[id]` requires `If-Match`; missing revisions return 428 and stale revisions return 409 with the current server character.
- SQLite updates compare and advance the revision atomically.
- The client serializes and coalesces writes per character. A conflict rebases pending optimistic edits onto the server copy and retries.
- Full server responses no longer overwrite newer optimistic edits.

## Derived rules

- Constitution modifier changes adjust maximum and current HP across every character level.
- Tough grants 2 HP per level when selected and 2 additional HP on later levels.
- Above-level-one creation records retroactive HP changes at the level where the ASI or feat was acquired, preserving deterministic level-down behavior.
- Passive skills use a shared pure function and exclude temporary roll-only check riders.
- Custom `kh` formulas now use the same rolled dice for animation, totals, and history; discarded dice are visibly marked.

## Persistence and deployment

- SQLite schema revision 3 adds character revisions and a `schema_migrations` ledger.
- Existing databases are adopted and migrated in place.
- Stored character JSON receives identity and bounded field validation when loaded.
- `/api/health` verifies database access, write-lock availability, and schema version.
- Railway no longer overrides its mounted volume with a relative data directory.
- Render and Railway health checks now use `/api/health`.
- `npm run db:backup` creates a consistent SQLite backup and retains seven copies.
- Development error logs are ignored and no longer tracked.

## Tests

- Added derived-stat tests for Constitution, Tough, creation history, and passive skills.
- Added save-coordinator tests for serialization and stale-write rebasing.
- Added route/database integration tests for revision requirements, stale conflicts, create/list/advance/reload/delete, schema adoption, and health checks.

## Verification

Final command and live-flow results are recorded after the full review gate below is completed.
