# CHANGES-16a — Conditions with teeth

Implemented from `docs/ai-project-proposal-16.md` §16a (effects-engine extension). 16b/16c not started — the proposal requires 16a to land and be reviewed first.

## What changed
- `src/types/game.ts` — `CharacterEffect` gains `advantageMode?: "advantage" | "disadvantage"` and `stack?: number` (1–6, for Exhaustion levels).
- `src/lib/validateCharacter.ts` — `effects[]` validation extended: `advantageMode` must be one of the two literal strings; `stack` must be an integer 1–6.
- `src/lib/effects.ts`:
  - Rewired condition presets: Blinded/Poisoned/Restrained → `advantageMode: "disadvantage"`; Invisible → `"advantage"`; Prone/Frightened/Grappled stay label-only (no mechanic, per spec). Added the missing Restrained/Invisible/Prone/Frightened/Grappled/Exhaustion presets — only Blinded/Poisoned/Concentrating existed before this round.
  - Exhaustion preset starts at `stack: 1` with disadvantage; `describeEffect()` now surfaces the stack level and, at level ≥3, an informational "speed halved / HP max halved (not automated)" note — no automated speed/HP penalties this round, matching the spec's documented 2014-RAW simplification.
  - New `effectiveAdvantageMode(effects)` helper: implements the 5e RAW rule that advantage and disadvantage from any number of sources don't stack — if both are present among active effects, they cancel to a normal roll.
- `src/components/ForgeAndFableApp.tsx` — restructured roll-mode state: `manualRollMode` (drawer override, one roll only) is now separate from `effectDrivenMode` (computed from `effectiveAdvantageMode`); the armed `rollMode` is `manualRollMode ?? effectDrivenMode`. Both `pushD20` and `pushPool` clear the manual override after a roll instead of forcing back to `"normal"`, so an active condition's mode persists roll after roll until removed, while a manual pick only lasts one roll.
- `src/components/RollDrawer.tsx` — new `rollModeIsFromEffect` prop; the "Next d20 roll uses X" hint appends "(from effects)" when the armed mode isn't a manual override.
- `src/components/HeroSheet.tsx` — effect rows show a small ADV/DIS chip when `advantageMode` is set; effects with a numeric `stack` (Exhaustion) get a −/+ level stepper (clamped 1–6) next to the row.
- `src/app/globals.css` — `.cs-effect-advmode` (chip) and `.cs-effect-stack` (stepper) rules appended at the end of the file.

## Verification
- `npm run lint` / `npm run build` — 0 errors (this session's baseline is now fully clean, 0 warnings too).
- **Live in the running app** (existing "Wexford the Oathbreaker" test character):
  - Added Poisoned (defaults active) → effect row showed the DIS chip immediately.
  - Rolled a STR check → roll history recorded `d20 dis [4, 16] keep 4` automatically, no manual mode selection needed. Drawer hint read "Next d20 roll uses disadvantage. (from effects)".
  - Manually armed Advantage in the drawer, rolled a DEX check → history recorded `d20 adv [2, 3] keep 3` (manual override honored for that one roll) — and the drawer hint immediately reverted to "disadvantage (from effects)" afterward, not "normal". This is the core one-shot-override-reverts-to-effect behavior the spec calls for.
  - Added Exhaustion, incremented the stepper from 1→3 → row text updated to include "speed halved / HP max halved (not automated)"; continued to 6 → the "+" button correctly disabled at the cap.
  - Server-side validation (isolated unit test against `validateCharacterInput`, not committed): valid `advantageMode`/`stack` accepted; `stack: 7`, `stack: 0`, and a bogus `advantageMode` value all correctly rejected with descriptive errors.
- Test effects (Poisoned, Exhaustion) removed from the test character after verification via the UI's own remove button — no manual DB edits.

## Scope notes
- Custom effects (the "Custom…" form) do not expose `advantageMode`/`stack` inputs — the spec only asked for preset rewiring and row-level display, not a custom-effect authoring UI for these two fields. Left out deliberately to keep this round bounded.
- Cancellation rule (advantage + disadvantage from different active effects → normal) wasn't explicitly required by the spec's wording ("such an effect" singular) but is correct 5e RAW and cheap to implement, so it's included rather than picking an arbitrary priority order between conflicting effects.

## Not yet done
16b (live campaigns) and 16c (table extras) — per the proposal's own sequencing, 16a should be reviewed before 16b starts, since 16b's DM condition-push feature depends on this effects-engine extension.
