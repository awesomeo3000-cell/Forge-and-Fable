# CHANGES-HB-6 — Class and Subclass Studio (in progress)

Phase 6 of `docs/ai-project-proposal-homebrew-studio.md`. This is a Critical-risk
phase being delivered in reviewable sub-rounds; this changelog is updated as each
lands. **Not yet complete** — remaining sub-rounds are listed in §Remaining.

## Sub-round 6a — level-up class picker (multiclass selection)

The deferred Phase-5 UI item: choosing which class gains a level, and
translating the single-class level-up modal into whole-character multiclass
state.

- **`src/lib/levelUpMulticlass.ts`** (new):
  - `classScopedCharacterView(character, classRef)` — hands `LevelUpModal` a view
    scoped to one class (`level` = that class's level, `subclassId` = that
    class's subclass), because the modal's internals are single-class.
  - `multiclassLevelUpPatch(character, targetRef, modalData)` — translates the
    modal's class-space confirm payload into a whole-character patch:
    `classLevels` via `addClassLevel`, mirror fields via `classLevelMirrors`, a
    subclass picked mid-level-up attached to the leveled class (not the mirror),
    progression **recomputed** on the merged multiclass character (the modal's
    single-class progression output is never passed through), and appended
    choice/spell history rewritten from class-level space to the new total
    level.
- **`src/components/HeroSheet.tsx`**: the level-up button opens a class picker
  (`cs-class-picker`) offering current classes plus eligible new built-in
  classes from `eligibleMulticlassOptions` (ineligible ones disabled with the
  unmet-requirement reason). A pure single-class character continuing its own
  class keeps the unchanged legacy path (no `classLevels` write); any other pick
  runs the modal in class space and applies the translated patch. Multiclass
  level-down is gated with a snapshot-restore hint (per-class unwind ships with
  the studio).
- Gate tests in `tests/multiclassFoundation.test.ts`: new-class translation
  end-to-end (validates server-side), and a mid-level-up subclass landing on the
  leveled class while the mirror stays with the primary class.

## Sub-round 6b — homebrew class/subclass packet normalization

The keystone that lets the Phase-5 injectable registry resolve a homebrew class
through the *same* `buildLevelUpPlan` path built-in classes use (proposal §8.4:
"do not build a second homebrew-only level-up engine").

- **`src/lib/homebrew/classPacketNormalization.ts`** (new):
  `normalizeHomebrewClassPacket(payload, ref)` → `ClassProgressionPacket` and
  `normalizeHomebrewSubclassPacket(payload, ref)` → `SubclassProgressionPacket`.
  Maps hit die, ability/save/armor/weapon data, aggregated skill/tool choices,
  per-level automatic features and resource grants, fills proficiency bonus for
  all 20 levels, and builds spellcasting slot/count tables for
  full/half/third/pact/custom modes (`slotsForMode` uses the shared
  `FULL_CASTER_SLOTS`; half rounds up from level 2 capped at 5th, third from
  level 3 capped at 4th; pact emits the warlock count/slot-level tables).
  Stable packet id `hb:<definitionId>`.
- **`src/lib/progression/engine.ts`**: `BuildClassLevelUpPlanInput` gains
  optional `classRef` / `subclassRef`. When set, the registry is asked for that
  exact ref — the only way to resolve a homebrew class, since `classId` alone
  always implies a built-in. Absent, a built-in ref is derived from `classId`
  (unchanged). Resolving a homebrew ref without a registry throws clearly.
- Gate tests in `tests/homebrewClassPacket.test.ts` (10): packet identity and
  1-20 fill, full/half/pact/none spell tables, and — the real proof — a homebrew
  class **and** homebrew subclass producing correct features, resources, spell
  changes, and proficiency bonuses through `buildLevelUpPlan` via an injected
  registry; wrong-parent and no-registry rejections.

## Sub-round 6c — server registry + homebrew multiclass resolution

Makes the server *ready* to accept and validate a character whose `classLevels`
include a pinned homebrew class — the class now flows through the same
validation/aggregation path built-in classes use.

- **`src/lib/homebrew/serverRegistry.ts`** (new): a `RulesContentRegistry` that
  delegates built-in refs to the static adapter and resolves homebrew class /
  subclass refs by reading their immutable pinned payloads
  (`readPinnedVersionPayload`) and normalizing them (6b). Server-only (imports
  the store/DB). Resolution is *pinned* — no access re-check, so a character
  keeps resolving a version it already pins after campaign access changes (§11.2).
- **`src/lib/progression/state.ts`**: `multiclassProgressionPatch` now passes
  `classRef`/`subclassRef` into `buildLevelUpPlan` and resolves homebrew entries
  through the injected registry instead of throwing. Still throws if a homebrew
  ref appears with no registry.
- **`src/lib/progression/validate.ts`**: `validateClassLevels` is
  registry-aware — homebrew class/subclass refs resolve through the registry
  (ruleset, duplicate, subclass-parentage, and selection-level checks all apply
  to homebrew); with no registry, only built-in refs are accepted.
- **`src/lib/vaultStore.ts`**: `createCharacter` and `updateCharacter` pass
  `serverRulesContentRegistry` into `validateCharacterProgression`, and
  `classLevels` joins the progression-touched field list.
- Integration gate (`tests/homebrewMulticlassServer.integration.test.ts`): a
  published homebrew class resolves through the server registry; a Fighter 3 /
  homebrew-Runeweaver 2 character saves with its homebrew features aggregated
  into `progressionState`; a ref to a non-existent version is rejected.

### 6c deferral (the live-path gap)

The **client** still computes the level-up progression patch without a registry
(`LevelUpModal` → `multiclassLevelUpPatch` → `progressionPatchForCharacter`), so
it cannot yet produce the progression state the server expects for a homebrew
class. Nothing selects a homebrew class into `classLevels` from the UI yet
(the 6a picker offers built-in classes only), so no live path sends this to the
server — the server is *ready*, tested directly. Closing the loop needs the
**client resolved-DTO registry** (§8.5: send the character's referenced class
DTOs to the client) plus access enforcement for a newly-selected homebrew class
(mirroring `validateNewHomebrewItems`). Both land with the selection sub-round.

## Sub-round 6d — available-classes listing, client registry, access enforcement

The plumbing the picker/modal need so a homebrew class can be selected onto a
character, and the server can trust it — everything except the interactive UI
wiring (that is 6e).

- **`src/lib/homebrew/homebrewStore.ts`**: `listAvailableClasses(userId,
  ruleset)` — latest published class versions the viewer owns or has via a
  shared campaign (mirrors `listAvailableItems`; the shared SQL is now
  `listAvailableDefinitionRows(userId, kind, ruleset)`).
- **`src/lib/homebrew/resolvedRegistry.ts`** (new, client-safe): `createResolvedRegistry(entries)`
  builds a `RulesContentRegistry` from homebrew class/subclass payloads the
  server sends — built-in refs delegate to the static adapter, homebrew refs
  normalize the provided payload with the *same* function the server uses, so
  client and server compute identical packets and therefore identical
  progression (§8.5). Imports no DB code.
- **`src/lib/levelUpMulticlass.ts`**: `multiclassLevelUpPatch` takes an optional
  registry and threads it into `progressionPatchForCharacter`, so the 6a
  translation works for homebrew classes once the client passes the resolved
  registry.
- **`src/lib/vaultStore.ts`**: `validateNewHomebrewClasses` — access enforcement
  for homebrew class/subclass refs newly added to `classLevels` (mirrors
  `validateNewHomebrewItems`): a newly selected ref must resolve to a *published*
  version the viewer may select; already-pinned refs are grandfathered (§11.2);
  missing/private content collapses to one error. Wired into `createCharacter`
  and `updateCharacter`. This is the security boundary — progression validation
  resolves *pinned* content (any version), so access is enforced separately here.
- **`src/app/api/homebrew/library/classes/route.ts`** (new): `GET` returns
  `listAvailableClasses` for the picker (mirrors the items library route).
- Tests: client-registry normalization + client↔server plan **parity**
  (`tests/homebrewClassPacket.test.ts`, +2); available-classes listing
  (owner sees it, non-owner does not), and three access denials — another user's
  private class, an owner's *draft* (drafts are not selectable), and a
  non-existent version (`tests/homebrewMulticlassServer.integration.test.ts`, +3).

### 6d deferral

Still no interactive path: the 6a picker offers built-in classes only, and
neither the picker nor `LevelUpModal` fetches `listAvailableClasses` or builds a
client registry yet. That UI wiring — offer homebrew classes in the picker, run
the modal with the homebrew class's facts, pass the resolved registry into
`multiclassLevelUpPatch` — is sub-round 6e.

## Sub-round 6e — interactive homebrew-class multiclass selection

A character can now actually multiclass into a homebrew class from the sheet,
end to end. Built-in classes keep the full `LevelUpModal`; homebrew classes use
a minimal, correct apply path (that modal is deeply built-in-coupled, so it is
left untouched).

- **`src/app/api/characters/[id]/homebrew-classes/route.ts`** (new): pinned
  resolution of a character's `classLevels` homebrew class/subclass payloads
  (no access re-check, §11.2) so the client registry can resolve classes the
  character already holds even if later unshared.
- **`src/components/HeroSheet.tsx`**:
  - Fetches `/api/homebrew/library/classes` (picker options) and the pinned
    payloads above, and builds a client `createResolvedRegistry` from both.
  - The class picker lists accessible homebrew classes under "Begin a new class"
    and "Continue {name}" for homebrew classes already held.
  - Selecting a homebrew class runs `applyHomebrewClassLevel`: fixed HP from the
    payload's hit die, then `multiclassLevelUpPatch(character, ref, hp,
    clientRegistry)` — the same translation the built-in path uses, now with the
    resolved registry so client progression matches the server.
- Integration gate (`tests/homebrewMulticlassServer.integration.test.ts`): a
  saved single-class fighter multiclasses into a published homebrew class via the
  exact client apply path (client registry + `multiclassLevelUpPatch`), and
  `updateCharacter` persists it with the homebrew class in `classLevels` and its
  features aggregated into `progressionState`.

### 6e deferrals

- **Homebrew spell / subclass / rolled-HP selection at level-up** — the minimal
  apply is fixed-HP only and offers no choice steps (homebrew classes emit no
  structured choices yet, 6b). A homebrew caster's spells and a homebrew
  subclass pick need the modal generalized for homebrew; that is a later
  sub-round.
- **Homebrew multiclass prerequisite enforcement** — the picker offers homebrew
  classes ungated (the payload's `multiclassPrerequisites` is authored but not
  yet evaluated); the server likewise does not enforce it. Deferred with the
  choice-model generalization.

## Test evidence (sub-rounds to date)

- `npx vitest run tests/homebrewClassPacket.test.ts` — 10 passed.
- `npx vitest run tests/homebrewMulticlassServer.integration.test.ts` — 3 passed
  (server registry resolution, homebrew-multiclass save + aggregation, missing-version rejection).
- `npx vitest run tests/multiclassFoundation.test.ts tests/homebrewClassPacket.test.ts tests/progressionValidation.test.ts tests/progressionEngine.test.ts tests/homebrewClassProgression.test.ts tests/characterApi.integration.test.ts tests/homebrewItemPinning.integration.test.ts` — 64 passed after the Phase-5 gate message was updated to the new "requires a content registry" wording.
- `npx tsc --noEmit` — clean. `npx eslint <touched files>` — clean.

## Deliberate deferrals within Phase 6 (documented, not silently dropped)

- **Structured per-level class `choices`** are normalized to `[]`. Offering them
  needs the modal's option renderer to read `ChoiceDefinition.from`; emitting
  choice ids now would surface picks the UI cannot render and validators would
  reject. Deferred to the class-selection-integration sub-round.
- **Feature descriptions on the sheet**: the packet carries feature *ids*; the
  resolver must carry homebrew feature descriptions to the client before the
  sheet can show them. Deferred to the sheet-integration sub-round.
- **Sheet-level slots for homebrew casters**: `casterContribution`
  (`src/lib/multiclass.ts`) still returns zero for non-built-in refs. Combined
  slots for a homebrew caster arrive with the resolver/sheet integration.

## Remaining Phase 6 sub-rounds

1. ~~Server registry~~ — **done (6c).**
2. ~~Client resolved-DTO registry, available-classes listing, class access
   enforcement~~ — **done (6d).** Remaining from this item: the interactive
   **6e** wiring — extend the 6a picker to offer accessible homebrew classes and
   run `LevelUpModal` with a homebrew class's facts + the resolved client
   registry. — **done (6e)**, minimal apply; homebrew spell/subclass/rolled-HP
   selection + multiclass-prereq enforcement remain deferred.
3. **Class & Subclass Studio editors** (foundation, proficiencies, spellcasting
   simple + advanced, 1-20 level guide, prerequisites, preview) with built-in
   template cloning.
4. **Sheet integration**: homebrew features/resources/labels, homebrew caster
   slots, structured class choices.
5. **Class/subclass version upgrade preview + snapshot rollback.**
6. **Freeform authoring mode** for classes/subclasses (§10A).
7. `docs/CHANGES-HB-6.md` finalization + independent review agent (proposal §14
   requires one before Phase 6 is accepted).

## Browser/runtime evidence

**Owed.** 6e is the first Phase-6 sub-round with a real UI surface (the class
picker now offers homebrew classes and applies a level). It was implemented and
verified by unit + integration tests, but not yet exercised in a running app:
the in-app browser tooling was classifier-blocked this session, and the
Phase 3-5 build/Playwright/browser debt still stands. To close: stop the
production server, `npm run build`, then manually author a homebrew class in
Class Studio (once its editor lands) or seed one, and multiclass a character
into it from the sheet; add a Playwright spec for the picker flow.

## Rollback notes

Revert the listed files; no migrations, no stored-data changes. No shipped UI
writes homebrew `classLevels` refs, so no character can hold state a rollback
would strand. The 6a picker only writes built-in multiclass state, which the
Phase-5 foundation already supports.
