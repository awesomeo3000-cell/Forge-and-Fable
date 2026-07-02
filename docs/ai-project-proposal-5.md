# Forge & Fable — Round 5: Sheet Interaction Fixes (safe scope)

**Audience:** An AI coding assistant executing this work in a fresh session.
**Repo root:** `E:\forge-and-fable`
**Out of scope (handled separately — do NOT attempt):** roll history log, ad-hoc dice pool selector, icon redesign, font normalization, module visibility/resizing.

---

## 1. Context

Forge & Fable is a Next.js 16 / React 19 / TypeScript D&D character builder. The sheet lives in `src/components/HeroSheet.tsx` (rendered by `src/components/ForgeAndFableApp.tsx`); character fields are typed in `src/types/game.ts`, and every new persisted field must be added to `ALLOWED_PATCH_FIELDS` + a validation case in `src/lib/validateCharacter.ts`. Dice rolls go through `props.onRoll(label, sides, count, modifier, onResult?)`. Styles live in `src/app/globals.css` (classes prefixed `cs-`).

Relevant current behavior:
- The vitals bar (`case "vitals"` in `sectionContent`) shows AC / Init / Speed / Prof / HP / Hit Dice / Death Saves. The Init cell is a plain `<div>`.
- `doShortRest()` resets `pactSlotsUsed` only; `doLongRest()` resets `spellSlotsUsed`, `pactSlotsUsed`, `concentratingOn`, and recovers hit dice. Neither touches HP and neither gives the user any visible feedback — the user reports them as "non-functional".
- The "Insp" button in `case "identity"` (`cs-inspire-btn`) has **no onClick** and is permanently styled highlighted.
- `.cs-death-dot` in globals.css is 8×8px — too small to click comfortably.

## 2. Ground Rules

1. Smallest change per task. No reformatting, renaming, or drive-by cleanup. Keep all existing `cs-*` class names.
2. No new npm dependencies. New persisted fields: optional on `Character`, allowlisted, validated.
3. Use existing CSS variables for colors; match surrounding code style.
4. After each task: `npm run lint` (0 errors) + `npm run build` (pass).
5. **Verify in the actually running app** (`npm run dev`, reuse the existing server if port 3000 is busy). State in the changelog what you clicked and what you observed.
6. **Deliverable:** `docs/CHANGES-5.md` — one entry per task, what changed + how verified. No entry = not done.

## 3. Tasks

### Task 5.1 — Click the Initiative cell to roll initiative

**File:** `src/components/HeroSheet.tsx`, vitals case.

Convert the Initiative vital cell from `<div className="cs-vital-cell">` to a `<button type="button" className="cs-vital-cell cs-vital-rollable">` with:
- `onClick={() => props.onRoll("Initiative", 20, 1, initiative)}`
- `aria-label={`Roll initiative, ${signed(initiative)}`}` and `title="Click to roll initiative"`.

CSS: `.cs-vital-rollable { cursor: pointer; }` plus a subtle hover (`background: rgba(0,0,0,0.04)` like `.cs-section-header:hover`). Buttons don't inherit font/color — add `font: inherit; color: inherit; text-align: inherit; border: 0;` alongside the existing `cs-vital-cell` grid styling so it renders identically to the other cells. **Only** the Initiative cell becomes clickable; AC/Speed/Prof stay divs.

**Accept:** the cell looks unchanged at rest, shows pointer+hover, and clicking flies a d20 with the character's initiative modifier. Keyboard: focus + Enter also rolls (native button behavior).

### Task 5.2 — Make short/long rest do their jobs, visibly

**Files:** `src/components/HeroSheet.tsx`, `src/components/ForgeAndFableApp.tsx`.

**(a) Feedback channel.** Add an optional prop to HeroSheet: `onNotify?: (message: string) => void`. In `ForgeAndFableApp`, pass `onNotify={setStatus}` (the existing status chip in the top bar renders it).

**(b) Long rest** (`doLongRest`): confirm first — `window.confirm("Take a long rest? HP and spell slots will be restored.")`, bail if declined. Then one `onUpdate` patch with:
- `currentHp: props.character.maxHp`
- `tempHp: 0`
- `spellSlotsUsed: {}`, `pactSlotsUsed: 0`, `concentratingOn: null` (existing)
- hit-dice recovery (existing formula: spent minus `Math.max(1, Math.floor(level / 2))`, floored at 0)
Then `onNotify?.("Long rest complete — HP and slots restored")`.

**(c) Short rest** (`doShortRest`): no confirm. Keep `pactSlotsUsed: 0` for pact casters. Then notify with a message that reflects what happened, e.g. for a pact caster: `"Short rest — pact slots recovered. N hit dice available (roll them in the Hit Dice vital)."`; for everyone else just the hit-dice part. Compute N as `level - (hitDiceSpent ?? 0)`. If N is 0 and the character isn't a pact caster, say `"Short rest — no hit dice remaining."`. Do NOT auto-roll hit dice.

**Accept:** wound a character, spend spell slots → Long rest → confirm → HP full, slots reset, status chip shows the message. Short rest → status message appears, pact slots reset for a warlock, nothing else changes.

### Task 5.3 — Inspiration becomes a real toggle

**Files:** `src/types/game.ts`, `src/lib/validateCharacter.ts`, `src/components/HeroSheet.tsx`, `src/app/globals.css`.

- Add `heroicInspiration?: boolean` to `Character`. Allowlist `"heroicInspiration"`; validation case: if present and not `undefined`, must be `typeof val === "boolean"` (else throw).
- The Insp button (identity case): `onClick={() => props.onUpdate({ heroicInspiration: !props.character.heroicInspiration })}`, `aria-pressed={!!props.character.heroicInspiration}`, className gains `cs-inspire-on` when true.
- CSS: make the **default** state muted (match the neighboring `cs-glass-btn` look — the current always-highlighted styling is the bug). `.cs-inspire-on` gets the accent treatment: accent border/text and a soft accent-tinted background (`color-mix(in srgb, var(--accent) 12%, transparent)` — same recipe as `.cs-weapon-chip.cs-weapon-on`).

**Accept:** button starts unhighlighted on a fresh character, toggles visually on click, state survives a page reload (it's persisted), and a second character's inspiration is independent.

### Task 5.4 — Bigger death-save dots

**File:** `src/app/globals.css` (`.cs-death-dot`, `.cs-vital-death-row`); markup untouched.

Increase `.cs-death-dot` from 8×8px to **14×14px** with `border-width: 1.5px`, and bump the row gap from 3px to 5px. The dots must still fit on one row inside the vitals cell next to the "S"/"F" labels and the "R" reset button at common widths — verify at ~1150px and at the mobile layout. If the row overflows the cell, allow the death-saves cell to wrap its row (`flex-wrap: wrap`) rather than shrinking the dots back down.

**Accept:** dots are visibly ~twice as large and comfortably clickable; vitals bar layout doesn't break at desktop or mobile width; filled success/fail states still render.

## 4. Verification & Deliverables

Smoke test: level 1+ character → click Initiative (d20 flies) → toggle Insp on/off → reload, state kept → damage the character + spend slots → Long rest (confirm dialog, full restore, status message) → Short rest (message; warlock pact slots reset) → click death-save dots (comfortable targets, states cycle).

`npm run lint` 0 errors; `npm run build` passes. **`docs/CHANGES-5.md`** with per-task entries: what changed, what you clicked, what you observed. Note anything skipped or adjusted explicitly.
