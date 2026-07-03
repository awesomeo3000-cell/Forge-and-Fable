# Forge & Fable — Round 8: Subspecies

**Audience:** Codex 5.5 (or comparable) in a fresh session.
**Repo root:** `E:\forge-and-fable`
**Feature:** group species variants under a parent and let players pick a **subspecies** (High Elf, Hill Dwarf, Forest Gnome, …) during creation, applying the subspecies' ability bonuses and traits on top of the base species.

## 0. Before you start: what already exists (do NOT rebuild)

The Artificer that earlier notes paired with this work is **already fully implemented** — verified in-tree:

- `ruleset.classes` has `id: "artificer"` (`src/lib/ruleset.ts:1371`): `casterType: "half"`, `subclassLevel: 3`, `hitDie: 8`, primaries INT/CON, full 1–20 `levelProgression` (`rawClassLearning.artificer`, `src/lib/ruleset.ts:575`).
- Saves and skill choices exist (`SAVE_PROFICIENCIES.artificer`, `CLASS_SKILL_CHOICES.artificer` in `src/lib/srd.ts`).
- Subclasses (Armorer, etc.) are in `src/data/subclasses.json`; the Artificer spell list is wired in `dnd-master-data.json`'s `spellClassLists` (94 spells map to `"Artificer"`).
- Half-caster slot math handles it (`maxSlots("half", …)` in `src/lib/spellSlots.ts`).

**Do not touch Artificer.** If you find a genuine defect while testing (one candidate: RAW Artificer gets a level-1 spell slot — it rounds *up* — whereas `maxSlots` treats "half" as `level < 2 ? 0 : ceil(level/2)`; other half-casters round down and start at 2). If you spot it, note it in the changelog as an observation; **do not fix it in this round** — it's a separate, rules-sensitive change.

## 1. Context (read first)

Next.js 16 / React 19 / TypeScript. Species live as a **flat** `races: Race[]` array in `src/lib/ruleset.ts` (`Race` type at `src/types/game.ts:11`). The 2024 species (`dragonborn`, `dwarf`, `elf`, `gnome`, `goliath`, `halfling`, `human`, `orc`, `tiefling`) and the 2014 "Legacy" entries (`elf-legacy`, `rock-gnome-legacy`, `forest-gnome-legacy`, `variant-aasimar`, …) are all **top-level, sibling entries**. There is no grouping and no subrace concept: several legacy entries lump multiple subraces into a single trait blurb (e.g. `elf-legacy` summary: "high, wood, and drow traditions"). That is the gap.

Ability bonuses apply through **one** function: `applyRaceBonuses(abilities, raceId, ruleset)` (`src/lib/utils.ts:284`) — it looks up the race and adds `race.bonuses[key]`. Call sites: `ForgeAndFableApp.tsx:183` and `:202`; a separate CON read for HP at `utils.ts:259-260`. Traits render on the sheet from `race.traits` (`ForgeAndFableApp.tsx:842`) and in the builder's species step. The builder maps `props.ruleset.races` directly with **no source filtering** (`CreatorPanel.tsx:578`), so everything visible today is a flat list.

Persistence: character data is a JSON vault behind `src/app/api/characters/*` with a strict field allowlist + validation in `src/lib/validateCharacter.ts` (follow the `effects` case as the model). Persisted updates go through `props.onUpdate(patch)` (PUT; **`JSON.stringify` drops `undefined` — send `null` or omit**). Styling: paper-document aesthetic, `dj-` builder classes / `cs-` sheet classes in `src/app/globals.css` (append new rules at the end), theme token vars (`--parchment`, `--ink-faint`, `--rule-soft`, `--accent`), radii ≤6px, no glow/gradients on paper.

## 2. Data model (the decision this round makes)

**Subspecies is a nested, additive option on the parent species — not new top-level entries.** This keeps saved characters valid (the field is optional), leaves the flat Legacy entries untouched, mirrors the 2014 subrace mental model your players expect, and confines ability-bonus stacking to the single existing merge point.

In `src/types/game.ts`, add:

```ts
export type Subspecies = {
  id: string;                    // unique within its parent, kebab-case
  name: string;                  // "Wood Elf"
  summary: string;
  bonuses?: Partial<AbilityScores>; // STACKS on top of the parent race bonuses
  traits?: FeatureUnlock[];         // APPENDED to the parent race traits
  speed?: string;                   // optional override, e.g. Wood Elf "35 ft."
};
```

and extend `Race`:

```ts
subspecies?: Subspecies[];
```

Add `subspeciesId?: string` to the character/draft type (find where `raceId: string` is declared — `types/game.ts`, and the draft default in `utils.ts:158` which sets `raceId: ""`). Leave `subspeciesId` unset by default.

**Application (one place, then propagate):**

- Change `applyRaceBonuses(abilities, raceId, ruleset)` → `applyRaceBonuses(abilities, raceId, subspeciesId, ruleset)`. After adding `race.bonuses[key]`, also add `subspecies.bonuses?.[key]` for the matching subspecies. Update **all** call sites: `ForgeAndFableApp.tsx:183`, `:202`, and the CON read at `utils.ts:259-260` (thread the character's `subspeciesId`). Do not add a second bonus path anywhere.
- Traits shown (sheet `ForgeAndFableApp.tsx:842` and the builder species step): render `race.traits` followed by the selected subspecies' `traits`.
- Speed: if the selected subspecies has `speed`, it overrides the race speed wherever speed is displayed.

**Starter data** (author in `ruleset.ts`, reuse the `speciesTrait()` helper for `traits`; bonuses are deltas *in addition to* the base species). Populate at least these on the 2024 base species — this directly satisfies the requested "Forest Gnome":

- `elf` → High Elf, Wood Elf (`speed: "35 ft."`), Drow
- `dwarf` → Hill Dwarf, Mountain Dwarf
- `halfling` → Lightfoot, Stout
- `gnome` → Forest Gnome, Rock Gnome, Deep Gnome

Mirror the flavor already written in the corresponding `*-legacy` summaries so the text is consistent. Chromatic/metallic Dragonborn, Aasimar (protector/scourge/fallen), and Tiefling legacies are **stretch** — do them only if the rest is solid, and say which you did in the changelog. Keep ability deltas SRD-plausible but you do NOT need perfect rules fidelity; consistency and the mechanism matter more than exact numbers.

## 3. Validation

Allowlist `"subspeciesId"` in `validateCharacter.ts`:

- optional; when present, a string ≤ 40 matching `/^[a-z0-9-]+$/`.
- Cross-check when feasible: import the ruleset and reject a `subspeciesId` that is not a subspecies of the character's `raceId` (return a readable 400, same style as the `effects` case). If you keep it shape-only, say so in the changelog and note the risk.

## 4. UI

**Builder species step** (`CreatorPanel.tsx`, the block around `:578`): after a species **with** `subspecies?.length` is selected, render a subspecies chooser directly under the stamped species row — a compact radio/segmented row of `dj-`-styled cards (name + one-line summary + the delta bonuses, e.g. "+1 DEX"). Selecting one sets `draft.subspeciesId`; re-selecting the species or picking one without subspecies clears it. For a species with no `subspecies`, render nothing (no empty control).

- **Finalize gate:** mirror the existing missing-list pattern (`CreatorPanel.tsx:754-762`). Add: if the chosen species defines subspecies and none is selected, push `"a subspecies"` into `missing`. (Species without subspecies are unaffected.)
- **SpeciesLearnModal** (`SpeciesLearnModal.tsx`): if `props.species.subspecies?.length`, list them as a read-only sub-section (name + summary + deltas) so players can compare before choosing. Props stay minimal; selection still happens in the step, not the modal.
- **Header / stamped row / sheet identity line:** where the species name shows, render "Elf — Wood Elf" when a subspecies is set (base name alone otherwise).
- Empty/neutral state: a species with no subspecies looks exactly as it does today.
- Keep new markup on `dj-subspecies-*` (builder) / `cs-` (sheet) class names; reuse `dj-` card, `chosen` pill, `cs-muted`, and token vars so dark skins (e.g. Necromancer) read correctly.

## 5. Constraints & landmines

1. **No new dependencies. No new top-level `races` entries** — subspecies are nested on existing parents. Do not migrate or delete the flat `*-legacy` entries.
2. `subspeciesId` is optional end-to-end: every existing saved character (none have it) must still load, validate, and render unchanged. Do not force a default subspecies.
3. **One bonus merge point.** `applyRaceBonuses` is the only place ability deltas apply — extend it, don't add a parallel path, or you'll double-count. Update every call site listed in §2; a missed site = wrong stats or a type error.
4. `quickbuild.ts` premades use some `*-legacy` raceIds and never set `subspeciesId` — that's fine (optional). Do not "upgrade" them this round.
5. All persistence through `props.onUpdate` — one patch per action. Send `null`/omit, never `undefined`, for `subspeciesId`.
6. `globals.css` is append-ordered — new rules at the end; never define a CSS var in terms of itself. Use token vars so it survives dark skins.
7. Enforce the `subspeciesId` rule **both** client-side (don't submit a subspecies that isn't the race's) and server-side (validation).

## 6. Verification (in the running app; reuse the dev server if the port is taken — launch config `forge-and-fable`, port 3005)

1. `npm run lint` 0 new errors; `npm run build` passes.
2. Create a character: pick **Elf** → the subspecies row appears → pick **Wood Elf**; confirm the DEX/whatever delta lands in the stat strip *on top of* the base Elf bonus, speed shows 35 ft., and the Wood Elf trait appears alongside base Elf traits. Forge the hero; reload — `subspeciesId` persists, sheet identity line reads "Elf — Wood Elf".
3. Pick **Human** (no subspecies): no chooser renders, Finalize is not gated on subspecies, everything behaves as before.
4. Pick **Gnome → Forest Gnome** (the requested case) and confirm end-to-end.
5. Try to Finalize an Elf with no subspecies selected → blocked with `Missing: a subspecies`.
6. `PUT /api/characters/:id` with `subspeciesId: "not-a-real-sub"` (or a valid-shaped id that isn't under the character's race) → 400. Omitting the field → 200.
7. Load a pre-existing character created before this round → renders unchanged, no subspecies shown.
8. Apply a dark skin (Necromancer) and confirm the subspecies chooser is readable.
9. Screenshots: species step with the chooser open (desktop + ~380px), and a finished sheet showing "Elf — Wood Elf".

**Deliverable:** code + `docs/CHANGES-8.md` (what changed per area, what you clicked, what you observed, deviations and any shape-only-validation compromise called out, plus which stretch species you added). No entry = not done.
