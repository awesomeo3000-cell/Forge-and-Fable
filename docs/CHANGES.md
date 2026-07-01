# Changelog

## 2026-07-01 — Bugfix and cleanup sweep

### Fixed
- **Subclass no longer persists on level-down.** When a character leveled back down below their subclass threshold, `patch.subclassId` was set to `undefined`, which `JSON.stringify` drops — so the PUT body never contained the field and the server kept the old value. Now sends `subclassId: ""` instead (empty string behaves as "none" in all truthiness checks).
- **Ability score validation now rejects non-number values.** Previously, `validateCharacter.ts` only ran `assertInteger` when `typeof abilities[a] === "number"`, so junk values like `"cat"` passed through silently. Now asserts **every present ability key** is an integer in 1–30 regardless of type.
- **Dead loading flags removed.** `isRulesetLoading` and `isCharactersLoading` were set but never read in the render — pure noise. Both state variables and all associated setter calls have been removed.
- **`setStatus` in 401 branch now guarded by `mounted`.** The characters fetch's 401 handler called `setStatus` outside the `if (mounted)` block, risking a setState-on-unmounted warning.
- **Dependency direction flipped.** `ALLOWED_PATCH_FIELDS` now lives in `validateCharacter.ts` (the library) and is imported by the route file, rather than the reverse. This avoids exporting non-handler symbols from a `route.ts`, which violates Next.js conventions.

### Added
- `docs/CHANGES.md` (this file) for tracking changes across runs.
- `README.md` now documents the `JWT_SECRET` environment variable required for auth.
