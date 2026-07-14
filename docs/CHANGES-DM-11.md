# CHANGES-DM-11 — Round Four A1: focal hierarchy — state grammar, initiative rows, adaptive density

Date: 2026-07-13
Round: DM Table Round Four, first sub-round (A1), per
docs/ai-project-proposal-26-dm-table-round-four.md. A2 (encounter log) ships
separately as CHANGES-DM-12.

## What changed

### A1.1 The state marker primitive
- New shared primitive in `CharacterStateVisuals.tsx`:
  `<span className="dm-state-marker" data-state="acting|selected" aria-hidden="true" />`,
  used by initiative rows, party rail cards, and the inspector header.
- Grammar (DM-11 CSS block, appended at the end of `globals.css`):
  - acting — small-caps "ACTING NOW" label (`.dm-acting-label`, rendered by
    the container), 3px left rule, filled triangular pointer, 7%
    `--dm-accent` wash, seal red.
  - selected — no label, 1px left rule (inset box-shadow, so no layout shift
    against the 3px transparent border), hollow ring marker, no background,
    `--dm-magic` blue.
  - Non-color redundancy holds in grayscale: labeled + thick + filled vs
    unlabeled + thin + hollow.

### A1.2 Combined state — acting suppresses selected
- Structural in CSS, not caller discipline: selected container treatment
  only applies via `.is-selected:not(.is-acting)`, and the selected ring is
  `display:none` inside an `.is-acting` container. One rule, one marker, one
  wash — never two.
- Party rail: the old `.is-current::before` "CURRENT" text and the blue
  `.is-selected` rule/wash are superseded by the primitive pair (the class
  is now `is-acting`; markers and the acting label render AFTER the card's
  buttons — the `>button:first-child` era selectors stay safe).
  Unconscious still outranks selection on the rail; acting outranks both.
- Initiative rows: `.dm-combatant.is-current` (CHANGES-DM-10 accent
  rule/wash) is superseded by `.is-acting` + label; player rows whose
  character is open in the inspector now carry the selected treatment.
- Inspector header carries both: its inherent selected context plus an
  "ACTING NOW" label (marker + label) when its character holds the turn.

### A1.3 Initiative row redesign — rows, not boxed cards
- Row anatomy left→right: die-pip disc (initiative number, now a bordered
  circle; hide/reveal click, `title` + new `aria-label` kept) · identity
  disc (standard density only; 36px `CharacterPortrait`/`cportrait` for
  player combatants via `memberUserId` lookup, `npc.portraitUrl` by
  exact-name lookup for NPC-sourced combatants, else the kind glyph
  ⚔ ✦ ● ○ as an inked token in the same disc) · name block (name, then
  condition/turn-state chips) · HP input + AC (DM-10 ink-weight tabular
  numerals kept) · actions.
- Duplicate visible names get `<sup class="dm-dup-badge">N</sup>` badges —
  real digits, not Unicode circled characters — assigned by order of
  appearance among identical names (`duplicateNameBadges`).

### A1.4 Adaptive density + the Compact control
- The Compact button is now GLOBAL compact presentation: rail cards AND
  initiative rows at any combatant count. State variable renamed
  `compactRail` → `compactTable`; localStorage key
  `forge-and-fable-dm-compact` unchanged (legacy preset migration kept).
- 9+ combatants auto-compact the initiative rows regardless of the button
  (`initiativeDensity(count, userCompact)` in
  `src/lib/dmTable/initiative.ts`, unit-tested). Auto-compacting does NOT
  toggle or visually activate the Compact button.
- Compact rows: identity disc hidden, die-pip + kind glyph kept, padding
  tightened, condition chips single-line capped at 2 with a "+N" overflow
  count (full labels in the title attribute).
- DELIBERATELY DEFERRED: enemy grouping (Goblin ×4 as one row) — it changes
  the combatant state model; out of scope per the proposal.

### A1.5 Row actions — the overflow split
- Always visible: Reaction as a real `<button>` state chip with
  `aria-pressed` (pressed = used; warning tone) — no more chip-that-secretly-
  behaves-like-a-button, and the old "R" icon button is gone; Turn (jump).
- Acting row only: Ready and Delay as visible buttons.
- Overflow ⋯ (`<details>` dropdown, matching the existing details pattern;
  summary and menu items keyboard-operable, menu closes on action):
  initiative ↑/↓, reroll + duplicate (non-players), Ready/Delay (non-acting
  rows, with "Clear ready/delay" when set), and Remove (destructive, behind
  the deliberate second click, existing no-confirm behavior unchanged).
- The 6-option visibility select stays as-is (non-players). Condition
  handling stays in the command row + inspector — untouched.

## Files
- `src/lib/dmTable/initiative.ts` — NEW: `initiativeDensity`,
  `duplicateNameBadges`, `INITIATIVE_AUTO_COMPACT_THRESHOLD`.
- `tests/dmTableInitiative.test.ts` — NEW: unit tests for both helpers.
- `src/components/dmTable/CharacterStateVisuals.tsx` — `StateMarker`.
- `src/components/DMTablePanel.tsx` — initiative row rewrite, Compact
  rename, density/badge wiring, inspector `acting` prop.
- `src/components/dmTable/PartyRail.tsx` — `is-current` → `is-acting`,
  markers/label after the buttons (sigil order kept).
- `src/components/dmTable/CharacterInspector.tsx` — header acting label.
- `src/app/globals.css` — one appended `/* -- DM-11 ... -- */` block; only
  `--dm-*` and semantic tokens, no legacy `--paper`/`--ground-2`/`--ink`.

## Verification
- `npm run build`, `npm test` (258 passing, incl. 6 new), `npm run lint`
  (0 errors; only the repo's pre-existing `no-img-element` warnings, plus
  the same warning on the new NPC-portrait `<img>`, matching the sigil
  pattern) — all green.
- The preview harness still wedges at the app login (known environmental
  issue), and this environment cannot reach the dev server directly —
  verified by build + computed-style reasoning against the cascade (the
  DM-11 block is the last `.dm-table` era, so its overrides win); the
  in-browser pass is the owner's screenshot check:
  1. Seat the rehearsal party, add 12 enemies including duplicate names
     (e.g. Goblin ×3) → 16 combatants: rows auto-compact, Compact button
     stays un-activated, dup badges render.
  2. Toggle Compact at low count: rail AND rows compact together.
  3. Advance turns with a character selected: acting row shows label +
     pointer + wash; selected-only row shows the thin blue rule + ring;
     a row that is both shows ONLY the acting treatment; inspector header
     gains ACTING NOW when its character holds the turn.
  4. Overflow ⋯ menu operates by keyboard (Tab/Enter); reaction chip
     toggles with `aria-pressed`.
  5. Grayscale screenshot: acting vs selected must stay unambiguous.
