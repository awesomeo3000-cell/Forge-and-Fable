# Homebrew Phase 3 — Item Studio vertical slice

Date: 2026-07-23

## Verified starting point

- Phase 0 is committed at `2cea04a` (`phase0homebrew`).
- Phase 1 is committed at `04178fc` (`API/DBupdates`).
- Phase 2 is committed and already on `origin/main` at `8493f95` (`updates`).
- The Phase 2 mechanics gate was rerun before this work: 5 files / 29 tests passed.
- The worktree was clean before Phase 3 began.

This corrects the initial assumption that Phase 2 was uncommitted. Phase 3 had
not started in source and this document records the first Phase 3 implementation.

## Implemented

### Item Studio

- Added an Item Studio entry to the authenticated workspace menu.
- Added a full-screen, responsive authoring workspace with:
  - blank item creation;
  - searchable clone-from-built-in flow with baseline provenance;
  - identity, category, classification, rarity, cost, image-compatible payload,
    base weight, equipment slots, AC, damage, damage type, and properties;
  - descriptions and creator-only notes;
  - attunement and displayable attunement prerequisites;
  - player-controlled toggles;
  - structured mechanic effect editing for numeric bonuses, ability floors,
    conditions, d20 riders, spell-slot bonuses, resources, senses, auras, and
    spell grants;
  - canonical `+1`, `+2`, and `+3` source-weapon presets;
  - equipped, attuned, toggle, equipped+attuned, and
    equipped+attuned+toggle activation gates;
  - immutable version history, change summaries, and explicit publishing.
- Staged growth remains visibly reserved for Phase 4. Phase 3 writes an empty
  `stages` list and does not expose a partial stage editor.

### Item contracts and conversion

- Extended `HomebrewItemPayload` with structured equipment fields (`ac`,
  `damage`, `damageType`, and `properties`) so a cloned weapon or armor keeps
  its usable rules data.
- Updated Phase 0 validators for the new optional fields.
- Added pure conversion helpers for:
  - blank payloads;
  - built-in catalog baselines;
  - published homebrew payloads to pinned inventory copies;
  - explicit version upgrades that preserve per-copy state;
  - human-readable upgrade previews.
- Homebrew mechanics use the inventory row id as `sourceInstanceId`, allowing
  two copies of the same version to remain independently explainable.
- Legacy prose parsers skip declarative homebrew items, preventing a `+2`
  description from being counted in addition to its structured effects.

### Character persistence and security

- `InventoryItem` can now persist a `HomebrewItemInstanceState` containing its
  exact immutable content ref plus notes, weight override, equipment state,
  attunement, body location, active toggles, and future stage state.
- Character input validation now validates nested homebrew item references and
  per-copy state with bounded strings, arrays, and weight values.
- Newly added item refs must:
  - resolve to a currently readable definition;
  - point to a published item version;
  - match the character ruleset.
- Existing pins continue resolving after deprecation or access loss.
- Existing-reference counts are consumed per copy during an update, so an old
  authorized pin cannot be reused to smuggle in an additional copy after the
  version becomes unavailable.
- Private and missing definitions collapse to the same character validation
  error and do not expose definition existence.
- Creator notes are stripped from character-facing and library-facing payloads.

### Character sheet integration

- Added authenticated APIs for:
  - currently selectable published items;
  - safe resolution of only the item refs already held by one owned character.
- Published items appear in the sheet item picker and are added as exact
  version pins.
- Each copy exposes:
  - equip/unequip;
  - attune/unattune;
  - body location;
  - weight override;
  - instance notes;
  - author-defined toggles;
  - pinned version and newer-version availability.
- Upgrade is an explicit preview-and-confirm action. Other copies and characters
  remain pinned to their prior version.
- Phase 2 mechanics are consumed by the sheet for:
  - ability floors;
  - AC, saves, checks, initiative, spell attack, and spell save DC;
  - character-wide and source-item weapon attack/damage bonuses;
  - extra spell slots;
  - d20 riders;
  - conditions, senses, resources, and aura provenance.
- Applied contributions are displayed in Effects & Conditions with their
  homebrew source label.

## Verification

- `npm run typecheck` — passed.
- `npm run lint:ci` — passed with zero warnings.
- Focused Phase 0–3 suite — 10 files / 77 tests passed.
- Full `npm test` completed with four 5-second timeouts in
  `characterApi.integration.test.ts` under prolonged serial-suite load; there
  were no assertion failures. The affected file was immediately rerun alone and
  all 13 tests passed in 37.8 seconds (individual tests 2.4–3.2 seconds).
- `npm run build` — passed under Next.js 16.2.9; both new API routes appeared in
  the production route table.
- Isolated authenticated browser QA — passed:
  - workspace menu exposed Item Studio;
  - full workspace rendered without console errors;
  - Longsword baseline preserved version provenance and equipment fields;
  - `+2 weapon` produced separate source-item attack and damage effects;
  - Moonsteel Blade v1 saved as a draft;
  - v1 published successfully and became character-selectable.

## New tests

- `tests/homebrewItemIntegration.test.ts`
  - built-in equipment-field cloning;
  - per-copy source-scoped mechanics;
  - explicit upgrade with preserved instance state.
- `tests/homebrewItemPinning.integration.test.ts`
  - authorized published pins;
  - private-definition rejection;
  - continued use after deprecation;
  - rejection of a newly added copy after deprecation.

## Deliberate Phase 3 boundary

The first vertical slice is implemented but Phase 3 should not be called fully
closed until its remaining acceptance work is added:

- dedicated component-level interaction tests for Item Studio;
- an authenticated end-to-end character flow covering add, equip, roll, save,
  reload, v2 publish, old-pin retention, and explicit upgrade;
- DM/read-only character-sheet resolution policy and presentation;
- richer prerequisite authoring beyond display text;
- final accessibility pass for focus trap/restoration and keyboard navigation;
- deployment and hosted manual sign-off.

Staged sentient-item growth, stage transitions, counters, milestone history, and
campaign aura propagation remain Phase 4 work.
