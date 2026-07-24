# CHANGES-HB-4 — Item stages, counters, and campaign-aware aura groundwork

Phase 4 of `docs/ai-project-proposal-homebrew-studio.md`. Growing/sentient items
are now functional and auditable: creators author ordered stages in Item Studio,
players advance stages manually with a diff preview, counters persist across
saves, and every stage change carries an audit entry.

## 1. Scope completed

- **Stage editor** in Item Studio (section 04): ordered stage cards with name,
  description, activation (manual / counter threshold / story milestone),
  per-stage structured effects (full `EffectEditor` reuse), reorder up/down,
  remove, and a 20-stage cap. Stage list edits re-derive `order` as `1..n`, so
  the payload can never hold duplicate or gapped orders.
- **Ordered stage validation** in `homebrewSchema`: duplicate stage orders and
  orders below 1 are rejected; counter activation now enforces a 1–64 char
  `counterId` and a bounded minimum (`1..HOMEBREW_LIMITS.counterMax = 9999`).
- **Character-sheet stage controls** in the homebrew item instance block:
  stage chips in order (current highlighted), a **diff preview** before any
  change (mechanics lost/gained, derived from `describeStageChange`), an
  optional reason, creator-defined **counters** with ± controls (bounded
  0–9999), a “stage ready” hint (✦) when a counter meets a stage threshold, and
  a collapsible **stage history** deriving old → new transitions.
- **Audit history**: each confirmed change appends
  `{ stageId, changedAt, changedBy, reason? }` (capped at the last 100). The
  actor is the signed-in user's display name, passed to `HeroSheet` via the new
  `actorName` prop; DM read-only views see stages/history but cannot change them.
- **Initial stage**: a fresh copy of a staged item starts in its first stage
  (`defaultItemInstance` → `firstStageId`), satisfying the “a four-stage weapon
  begins with +1” gate.
- **Version upgrades**: `upgradeHomebrewInventoryItem` keeps the pinned stage
  when the new version still defines it, otherwise remaps to the new first
  stage; `describeItemUpgrade` now reports stage-count changes and removed-stage
  remapping in the upgrade preview.
- **Overdrawn slot presentation** on the sheet: when a stage revert (or version
  change) removes a bonus slot while more slots are spent than the new maximum,
  the spell level shows an `overdrawn +N` chip (plus screen-reader text) instead
  of silently clamping or erasing casts (§6.5).
- **Auditable combat-event contract** (`ItemCombatEvent` in
  `src/types/homebrew.ts`): `weapon-attack-hit`, `weapon-critical-hit`,
  `creature-defeated`, `encounter-completed`, each identifying character, item
  instance, reporter, and time. **No producer exists yet — stage advancement
  remains 100 % manual** (see §8 below).
- **Aura resolution DTO groundwork** (`AuraResolutionDto` in `homebrewDtos.ts`):
  the campaign-facing shape for a later round to propagate non-self auras;
  `recipients` stays empty until campaign presence/range data exists. Local
  resolution of auras (self-resolve; non-self captured) was already in the
  Phase 2 resolver and is unchanged.
- **Server-side instance validation** (`validateCharacter.ts`):
  `currentStageId` (≤ 64 chars), `counters` (≤ 20 keys, integer 0–9999),
  `stageHistory` (≤ 100 entries; `stageId`/`changedAt`/`changedBy` required,
  `reason` ≤ 200 chars) — all on the existing character write path.

## 2. Files changed

- `src/lib/homebrew/homebrewSchema.ts` — ordered-stage validation, `counterMax`.
- `src/lib/homebrew/itemIntegration.ts` — `sortedStages`, `firstStageId`,
  `stageCounterIds`, `summarizeEffect`, `describeStageChange`, initial-stage
  default, upgrade stage mapping, upgrade-preview stage lines.
- `src/lib/homebrew/homebrewDtos.ts` — `AuraResolutionDto`.
- `src/types/homebrew.ts` — `ItemCombatEventType`, `ItemCombatEvent`.
- `src/lib/validateCharacter.ts` — stage/counter/history instance validation.
- `src/components/HomebrewStudio.tsx` — `StageEditor`, stages section 04,
  normalized stage handlers; removed the Phase-4 lock note.
- `src/components/HeroSheet.tsx` — stage chips, diff-preview confirm, counters,
  history, `actorName` prop, overdrawn slot chip.
- `src/components/ForgeAndFableApp.tsx` — passes `actorName={user.name}`.
- `src/app/globals.css` — `hb-stage-*`, `cs-homebrew-stage*`,
  `cs-homebrew-counter*`, `cs-slot-overdrawn` styles.
- `tests/homebrewItemStages.test.ts` — new Phase 4 suite (16 tests).
- `tests/homebrewStudio.test.tsx` — stage-authoring component test.

## 3. Data/schema decisions

- No database or DTO wire changes: stages already lived in the versioned payload
  (Phase 0 contract), and all new per-copy state (`currentStageId`, `counters`,
  `stageHistory`) already existed on `HomebrewItemInstanceState`, stored inside
  the character aggregate. `SCHEMA_REVISION` is untouched (26).
- Stage history entries keep the frozen contract shape (`stageId`, not
  old/new pairs); the old stage is derived from the previous entry (or the
  item's first stage) at display time. The proposal's audit gate (“actor, time,
  old/new stage, reason”) is met without widening the frozen type.
- Counter bounds (0–9999) match between the sheet control, the payload
  threshold validator, and the server-side instance validator.

## 4. Compatibility decisions

- Items added before this phase (staged payloads with `currentStageId`
  undefined) render a stage row with no current chip; selecting a stage is the
  entry into the staged lifecycle. Nothing breaks; no migration required.
- Non-staged items are completely unaffected (`stages: []` renders nothing).
- The pre-existing upgrade behavior that *reset* `currentStageId` to undefined
  on version upgrade was replaced with keep-or-remap-to-first; this only affects
  staged items, which could not be authored before this phase.
- Legacy inventory rows without `homebrew` state and legacy equipment
  continue through the unchanged legacy paths.

## 5. Test evidence

- `npx vitest run tests/homebrewItemStages.test.ts tests/homebrewSchema.test.ts
  tests/homebrewMechanics.test.ts tests/homebrewItemIntegration.test.ts
  tests/homebrewMechanicsSchema.test.ts tests/itemEffectResolution.test.ts
  tests/spellSlotContributions.test.ts` — **7 files, 79 tests passed**.
- `npx vitest run tests/homebrewStore.integration.test.ts
  tests/homebrewApi.integration.test.ts
  tests/homebrewAuthorization.integration.test.ts
  tests/homebrewItemPinning.integration.test.ts tests/homebrewStudio.test.tsx`
  — **5 files, 28 tests passed** (before the stage component test was added).
- `npx vitest run tests/homebrewStudio.test.tsx` — **3 tests passed** (includes
  the new stage-authoring test asserting normalized orders and counter
  activation in the save payload).
- `npx vitest run tests/characterApi.integration.test.ts tests/effects.test.ts
  tests/equipment.test.ts tests/characterRuleset.test.ts` — **4 files, 26 tests
  passed** (regression sweep over adjacent surfaces).
- `npx tsc --noEmit` — clean.
- `npx eslint <all touched files>` — clean after one unescaped-entity fix.

Gate scenario coverage (proposal §14 Phase 4), all in
`tests/homebrewItemStages.test.ts` against the Phase 0 `sentientWeapon`
fixture: begins at +1; stage 2 → +2 with stage-1 effects gone; stage 3 adds one
3rd-level slot; stage 4 exposes the Bless aura; revert produces the overdrawn
presentation without erasing casts; duplicate resolution is idempotent;
counters and history survive `validateCharacterInput`; upgrade keeps or remaps
the stage.

## 6. Browser/runtime evidence

**Deferred — two independent blockers, both environmental:**

- The in-app browser tooling was down for this entire session (the permission
  classifier model `claude-opus-4-8` returned “temporarily unavailable” for
  every browser tool call over several hours), so no authenticated browser pass
  was possible.
- `npm run build` was deliberately **not** run: the production `next start`
  server (PID 14100) is serving from `.next` on port 3000, and rebuilding under
  a live server is prohibited by project practice. The Playwright suite boots
  `npm run start` from that same `.next`, so it would have exercised the stale
  pre-Phase-4 build and produced misleading evidence.

**To close this gate:** stop the production server, run `npm run build`, run
`npx playwright test QA/tests/homebrew-item-lifecycle.spec.ts`, restart the
server, and do a manual staged-item pass (author Dawnbringer → add to a
character → advance/revert stages → verify diff preview, counters, history,
overdrawn chip). A stage-lifecycle Playwright spec is a recommended follow-up.

## 7. Deviations from the proposal

- **DM approval setting for stage changes** (“if required by product policy”):
  not implemented. No product policy requires it yet; stage changes are
  player/DM-manual and fully audited. Revisit with campaign policy work in
  Phase 8.
- **Automatic counters from authoritative events**: none wired, because no
  authoritative combat event exists (the proposal itself predicts this). The
  event contract is frozen; producers are a later sub-round.
- **Milestone activation** is display/audit metadata only (as proposed): a
  milestone stage is still entered manually, with the milestone label shown on
  the stage chip's tooltip.

## 8. Known manual-only behavior

- All stage advancement is manual. Nothing in the app claims automatic growth.
- Milestone completion is a human judgment; the app records who/when/why.
- Non-self aura propagation to allies is **not** delivered — the aura is
  resolved locally, badged for the source character, and captured in
  `ResolvedMechanics.auras` / typed for `AuraResolutionDto`. Campaign
  propagation is Phase 8.

## 9. Rollback notes

- Revert the listed source files; no migrations, no stored-data changes. Saved
  characters that already contain stage state remain valid under the previous
  code (the fields were already legal on the frozen contract; pre-Phase-4
  validation simply ignored them).
- The one behavioral revert to watch: going back restores the old
  upgrade-resets-stage behavior for staged items.

## 10. Next-phase blockers

- **Phase 5 (multiclass/progression foundation)** has no dependency on this
  round's code; it can start immediately. Its own risk gates (call-site audit of
  `character.level`/`classId`, registry injection) are unchanged.
- The deferred browser/build/Playwright evidence for Phases 3-4 should be
  captured once the production server can be safely restarted; treat it as an
  open verification debt, not a code blocker.
