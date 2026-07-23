# CHANGES-HB-0 — Phase 0: Contract freeze and regression harness

**Phase:** 0 (Contract freeze) of `docs/ai-project-proposal-homebrew-studio.md`
**Risk:** Medium
**Status:** Complete. No database tables, API routes, UI, or character persistence in this phase.

## 1. Scope completed

Locked the homebrew content data contracts and their pure validators before any
storage or UI work:

- Frozen TypeScript contracts for content refs, definitions/versions, the
  prerequisite AST, the mechanics AST (gates + effects), and all five payload
  kinds (item, class, subclass, species, feat).
- Dependency-free validators returning `{ path, message }` diagnostics for every
  contract, accepting `unknown` and never throwing on hostile input.
- A static built-in `RulesContentRegistry` adapter over the existing global
  `progressionCatalog`, so later phases can inject a registry instead of
  importing the catalog directly.
- Acceptance fixtures for every worked example in the proposal.
- Vitest coverage for valid fixtures and malformed/hostile payloads.

## 2. Files changed

Added (no existing files modified):

- `src/types/homebrew.ts` — all Phase 0 contracts (§§4–10), the
  `RulesContentRegistry` interface (§8.5), and `ContentResolutionError`.
- `src/lib/homebrew/homebrewSchema.ts` — pure validators + `HOMEBREW_LIMITS`.
- `src/lib/homebrew/builtinRegistry.ts` — static built-in registry adapter.
- `tests/fixtures/homebrew.ts` — canonical acceptance fixtures.
- `tests/contentRef.test.ts`
- `tests/homebrewMechanicsSchema.test.ts`
- `tests/homebrewSchema.test.ts`
- `tests/homebrewRegistry.test.ts`
- `docs/CHANGES-HB-0.md` (this file).

## 3. Data / schema decisions

- **No DB changes.** `SCHEMA_REVISION` remains 25. Verified before starting.
- `HOMEBREW_SCHEMA_VERSION = 1` constant introduced for future payload migration
  branching.
- Validation bounds centralized in `HOMEBREW_LIMITS` (proposal §6.3 / §17):
  numeric bonus −20..20, ability floor 1..30, spell level 1..9, resource max
  0..999, aura radius 0..1000, ≤100 effects, ≤20 stages/toggles, nesting depth 8,
  title 120 chars, description 20 000, creator notes 10 000, payload 256 KB.
- `hitDie` restricted to valid die sizes {4,6,8,10,12} rather than a numeric
  range.
- Gate `toggle`/`stage` references are cross-checked against the toggles/stages
  the item payload actually declares (via an internal `GateContext`). For
  non-item payloads the context is empty, so toggle/stage gates are correctly
  rejected there.
- Effect ids must be unique within a list; auras may not nest inside auras
  (enforced structurally, matching the `Exclude<…, {type:"aura"}>` type).

## 4. Compatibility decisions

- Purely additive. `src/types/game.ts` and all runtime code are untouched, so a
  character with no homebrew references behaves exactly as before (invariant
  §3.3).
- The static built-in catalog remains the source of truth; the registry adapter
  wraps `getProgressionPacket` and returns the **same** packet object
  (asserted with `toBe`), proving it is a faithful pass-through, not a behavior
  change.
- `HomebrewItemInstanceState`, `CharacterClassLevel`, and
  `CharacterFeatSelection` are declared but **not** wired into `Character`; those
  integrations belong to Phases 3/5/7.

## 5. Test evidence

Commands and results (run on this machine):

- `npx vitest run tests/contentRef.test.ts tests/homebrewMechanicsSchema.test.ts tests/homebrewSchema.test.ts tests/homebrewRegistry.test.ts`
  → **4 files, 49 tests, all passing.**
- `npx tsc --noEmit` → exit 0 (no type errors).
- `npx eslint --max-warnings=0` over all new files → exit 0 (no errors/warnings).
- Full suite (`npm test`) run to confirm no regressions in the existing suite.

Gate checklist (proposal Phase 0):

- ✅ Payload validation accepts every required fixture (+2 weapon, Strength-floor
  armor, Ring of Invisibility, four-stage sentient weapon with a 3rd-level slot
  and Bless aura, full caster, partial caster, subclass template, species with a
  level-5 benefit, repeatable distinct-choice feat).
- ✅ Malformed nesting, duplicate ids, invalid refs, and out-of-range values fail
  with field paths.
- ✅ Existing unit suite remains green (see full-suite run above).

## 6. Browser / runtime evidence

None applicable. Phase 0 adds no UI, route, or preview-observable surface; the
work is validated entirely under Vitest + `tsc`.

## 7. Deviations from the proposal

- The proposal leaves several helper types unspecified. Phase 0 defines minimal,
  documented shapes for them, to be extended in later phases:
  `ChoiceDefinition`/`ChoiceSource`, `HomebrewProgressionLevel`,
  `HomebrewFeatureGrant`, `SpellGrantDefinition`.
- `SpeciesProgressionPacket` and `FeatProgressionPacket` are lightweight
  placeholders; their full shapes are designed in Phases 6–7. The static registry
  intentionally raises `ContentResolutionError` for built-in species/feat
  resolution because no built-in packets exist for them yet.
- Suggested test filenames from the proposal were followed, plus an extra
  `tests/homebrewRegistry.test.ts` for the registry adapter deliverable.
- `spell-slot-bonus.amount` given an explicit bound of 1..20 (proposal specifies
  only the slot level 1..9).

## 8. Known manual-only behavior

- Prerequisite evaluation is three-state (`eligible`/`ineligible`/`unknown`); the
  `unknown` result and `manualApprovalText` path are contract-only in Phase 0 —
  the evaluator itself lands with the resolver in Phase 2.
- Only the built-in class/subclass registry path is implemented. Homebrew
  (database) resolution is Phase 1/2.

## 9. Rollback notes

Fully additive. To roll back, delete the eight added files listed in §2. No
migrations, no data, and no existing modules were changed, so removal cannot
affect existing characters or the build.

## 10. Next-phase blockers

None. Phase 1 (versioned registry, storage, API) can begin against these frozen
contracts. Before Phase 1, an agent should:

- Re-confirm `SCHEMA_REVISION` (currently 25) and claim the next revision for the
  `homebrew_definitions` / `homebrew_versions` / `campaign_homebrew_access`
  tables (proposal §4.4).
- Treat `src/types/homebrew.ts` and `homebrewSchema.ts` as the authority for
  payload shape; server publish/validate paths must call
  `validateHomebrewPayload` rather than re-deriving rules.
