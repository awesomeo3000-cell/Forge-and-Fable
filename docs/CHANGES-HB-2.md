# CHANGES-HB-2 — Phase 2: Runtime resolver and mechanics engine

**Phase:** 2 (Runtime resolver and mechanics engine) of `docs/ai-project-proposal-homebrew-studio.md`
**Risk:** High
**Status:** Engine complete. Sheet/derived-stat wiring is Phase 3.

## 1. Scope completed

Declarative `MechanicEffect`s now resolve into explainable character
contributions through one engine, following the deterministic order in §6.4.
Built-in and homebrew item references resolve through one interface; every
applied effect carries source provenance.

## 2. Files changed

Added:

- `src/lib/homebrew/effectGate.ts` — pure `EffectGate` evaluator (fail-closed).
- `src/lib/homebrew/mechanicsResolver.ts` — the engine: deterministic resolution,
  provenance, source-item scoping, stacking rules, ability floors, spell-slot
  deltas, conditions/riders/senses/resources, self-aura resolution, idempotency,
  and `computeSlotAvailability` for overdraw.
- `src/lib/homebrew/mechanicSources.ts` — adapters: homebrew item instance,
  legacy `CharacterEffect`, and legacy prose-parsed item → one `MechanicSource`.
- `src/lib/homebrew/contentResolver.ts` — server-side pinned-ref → source
  resolution.
- `tests/homebrewMechanics.test.ts` (9), `tests/itemEffectResolution.test.ts`
  (10), `tests/spellSlotContributions.test.ts` (5),
  `tests/homebrewContentResolver.integration.test.ts` (3).
- `docs/CHANGES-HB-2.md` (this file).

Modified:

- `src/lib/homebrew/homebrewStore.ts` — added `readPinnedVersionPayload`
  (auth-free pinned-content read for runtime resolution; never used on a
  discovery/list route).
- `src/lib/itemCatalog.ts` — exported the existing `ItemLike` type for the prose
  adapter (type-only change, no behavior).

## 3. Design decisions

- **Deterministic order (§6.4):** base scores → (native replacement, external) →
  floors (strongest wins) → additive numeric bonuses → riders/conditions/senses/
  resources → source-grouped presentation. The resolver returns both values and a
  `ResolvedContribution[]` provenance list.
- **Source-item scope:** `scope: "source-item"` bonuses accumulate into a
  per-instance bucket (`sourceItemBonuses[instanceId]`), never the character-wide
  totals — so a +2 weapon only buffs itself.
- **Stacking:** default `stack` sums; `same-source-nonstacking` takes the max per
  content-definition per target, then sums across distinct definitions.
- **Idempotency:** contributions are keyed by `sourceInstanceId + effectId`;
  passing the same source twice yields the same result.
- **Overdraw (§6.5):** `computeSlotAvailability(baseMax, delta, used)` never
  clamps `used`; if a removed bonus slot leaves `used > max`, the level reads
  `overdrawn: true` rather than silently erasing casts.
- **Auras:** `recipient: "self"` resolves inner effects locally now; ally/all
  auras are recorded for the campaign-propagation phase, not applied to self.
- **Pinned resolution (§11.2):** `readPinnedVersionPayload` reads by id without an
  ownership/visibility check, so a character keeps resolving content after
  campaign access is revoked or the version is deprecated (test-verified).

## 4. Compatibility

- Purely additive; no existing runtime path changed. Legacy `CharacterEffect` and
  prose-parsed item bonuses are represented through the same engine via adapters,
  so Phase 3 can converge the sheet onto one bonus engine rather than two.
- Advantage-mode and exhaustion stacking remain with legacy `effects.ts` (no
  `MechanicEffect` equivalent yet); the adapter maps flat bonuses, d20 riders, and
  senses only.

## 5. Test evidence

- `npx vitest run tests/homebrewMechanics.test.ts tests/itemEffectResolution.test.ts tests/spellSlotContributions.test.ts` → **24 passed.**
- `npx vitest run tests/homebrewContentResolver.integration.test.ts` → **3 passed.**
- `npx tsc --noEmit` → exit 0; `npx eslint --max-warnings=0` over new/changed files → exit 0.
- Full suite (`npm test`) run to confirm no regressions.

**Phase 2 gate:**

- ✅ +2 weapon affects only attacks/damage made with that item (source-item bucket; character totals untouched).
- ✅ Strength-floor armor: 18 → 19, 20 → 20, and no effect while unequipped.
- ✅ Invisibility activates only with equip + attune + toggle (each missing gate suppresses it).
- ✅ Removing a bonus slot produces a valid overdrawn presentation (no clamping).
- ✅ Duplicate evaluation of the same effect instance is idempotent.
- ✅ Every applied contribution has source provenance.

## 6. Browser / runtime evidence

None. Phase 2 is pure engine logic with no preview-observable surface; validated
under Vitest + `tsc`. Sheet rendering of contributions arrives with Phase 3.

## 7. Deviations from the proposal

- **Client registry (minimal resolved DTOs) deferred to Phase 3.** It is a UI
  data-shaping concern (send only the refs a character uses); the server-side
  resolution seam and the built-in `RulesContentRegistry` (Phase 0) are in place.
- **Progression `RulesContentRegistry` server adapter** (resolving homebrew *class*
  packets) lands with Phase 5/6, where homebrew progression packets first exist.
  Phase 2 covers item/effect resolution, which is the whole Phase 2 gate.
- Legacy advantage/exhaustion not modeled as `MechanicEffect`s (see §4).

## 8. Known manual-only behavior

- Ally/all-creature aura propagation is recorded but not applied (needs campaign
  presence/range — Phase 4/8).
- Spell-grant effects record provenance only; the grant's spell-list wiring is a
  later character-integration concern.

## 9. Rollback notes

Additive. Delete the four added `src/lib/homebrew/*` files + four test files, and
revert the two type-only edits (`readPinnedVersionPayload`, `ItemLike` export).
No schema or data changes.

## 10. Next-phase blockers

None. Phase 3 (Item Studio vertical slice) can consume `resolveMechanics` +
`resolveHomebrewItemSources` to drive the sheet, and should:

- Wire `sourceItemBonuses`, `abilityFloors`, `spellSlotDeltas`, conditions, and
  senses into the existing derived-stat/attack pipeline (one engine, per §7.2).
- Add the inventory/equipment detail controls (equip/attune/toggle/stage) that
  feed `GateState`, and render the provenance breakdown.
