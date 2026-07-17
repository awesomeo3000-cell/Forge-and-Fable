# Proposal 35 — Dice Tray Redesign (RollDrawer)

Owner note 2026-07-17: the tray works but "retains the design philosophy and
feel of the previous version of the website" — it should improve aesthetically
and as UX. Three options below, smallest to largest; each is independently
shippable and each builds on the previous one (A ⊂ B ⊂ C), so they can land as
phases. Mockups were reviewed in-session on 2026-07-17.

## Current state (audited)

- Component: `src/components/RollDrawer.tsx` (~731 lines, self-contained).
  Right-edge drawer on desktop, bottom sheet ≤760px (mobile pass 2). Tabs:
  Dice / Combat (combat = initiative + combatant quick-add).
- Legacy styling: uses `glass-button` and `gold-button` classes from the
  pre-Arcane-Observatory era (globals.css), NOT the `.ao-*`/token recipes.
  This is the root of the "old feel".
- Logic that already works and must not regress:
  - Pool builder `bump(sides, ±1)` per die; modifier stepper; formula input
    via `parseDiceFormula` (supports `2d6+3`, `4d6kh3`).
  - Adv/Dis applies to the **next d20 only** (correct per 5e); history entries
    record both d20 faces + kept index (`entry.adv`).
  - History colour-codes by roll category (attack/save/skill/damage regexes).
  - Sheet-triggered rolls arrive via props (`onRollPool`, history entries) —
    the drawer is the shared display surface.
- Known UX defects (all confirmed in code/screenshot):
  1. Three overlapping input models (chips + stepper + formula) with unclear
     precedence; placeholder literally says "Or type a formula".
  2. Adv/Dis segmented control looks global while 6d6 is pooled; its filled
     NORMAL state is the loudest brass element in the panel.
  3. Brass overused (tab outline + selected dice + NORMAL + Roll); primary
     Roll label is small dark-on-gold with an equal-weight Clear beside it.
  4. "d6" chip with a bare count number under it reads as "d66"; the corner
     "–" badge's meaning (remove one? all?) is unclear.
  5. No result moment — outcomes land only in the history list.
  6. Stale-pool footgun: leftovers accumulate (the screenshot's accidental
     "Roll 6d6 + 1d20").
  7. Utility chrome (drag dots, resize glyph) reads as a debug widget.

## Design-token vocabulary to use (no new tokens needed)

- Panel: `--surface-panel` #142235 on `--surface-panel-recessed` wells,
  border `--border-strong`, radius `--radius-md`, matte shadow recipe from
  the AO-16 dashboard panels (`inset 0 1px 0 rgba(255,255,255,.025), 0 12px
  28px rgba(0,0,0,.16)`). No blur/glass/glow.
- State grammar: selection/preview = `--state-selected` blue; the ONE brass
  element is the Roll button (existing `.ao-hd-btn-primary` gradient recipe).
- Type: totals/CTA label in `--font-role-display` (Fraunces); uppercase
  micro-labels in `--font-role-label` with `--label-tracking`.
- New classes namespaced `.ao-dice-*` in arcane-observatory.css (append at
  file end per repo landmine rules; scope under
  `[data-theme="arcane-observatory"]`). Leave `glass-button`/`gold-button`
  untouched elsewhere; RollDrawer simply stops using them.

---

## Option A — Observatory re-skin (S, ~½ day)

Pure presentation pass. No behavioural change, no state-shape change.

1. New CSS block `.ao-dice-*` (panel, chip, segmented control, roll button,
   ghost button, result card, history rows) using the vocabulary above.
2. RollDrawer class swap: `glass-button`/`gold-button` → new classes.
3. State-grammar fixes: selected die chips get blue inset ring + `×N` count
   chip (fixes the "d66" misread); Adv segmented control switches to the
   quiet app recipe (blue selected, never brass); Dice/Combat tabs match the
   app's segmented-control style.
4. Primary CTA: full-width brass Roll with Fraunces label at ~1rem; Clear
   demoted to a ghost text button beneath it.
5. Result visibility (minimal version): pin the most recent history entry in
   a recessed "Last roll" card above the history list — big Fraunces total,
   small breakdown line (reuse the entry's existing rolls/kept data).
6. Copy: "DIS/ADV" → "Disadvantage/Advantage"; em dash in the empty-state
   line; header "Dice & Combat" → "Dice Tray".
7. Chrome: replace drag-dot/resize glyphs with quieter 1-colour affordances;
   keep behaviour.

Acceptance: no logic diffs (props/state untouched); mobile bottom sheet
unaffected at 390px; keyboard/focus states preserved; lint/build green.

## Option B — Roll ticket (M, ~1–1.5 days, includes A)

Restructure input into one source of truth and give the roll a payoff moment.

1. **Ticket model**: single client state `ticket: { groups: [{sides, count,
   keepHighest?}], modifier, d20Mode }` rendered as a chip row ("2d6 ✕"
   "1d20 · adv ✕" "+3"). Die buttons append to the ticket; each ticket chip
   has its own remove ✕; the modifier lives on the ticket as a `+N` chip
   (click to edit / long-press steppers).
2. **Formula sync**: typing a valid formula *replaces* the ticket (parse via
   existing `parseDiceFormula`); the ticket always re-serialises into the
   input placeholder area, so both views agree. Invalid input keeps current
   error line. Delete the separate modifier stepper row.
3. **Adv scoping — read carefully, two separate systems**. Advantage serves
   two roll paths today, both armed by the tray's one segmented control:
   (a) manual pool rolls built in the tray, and (b) sheet-triggered d20
   rolls (`rollD20ForAbility` in ForgeAndFableApp honors
   `rollMode = manualRollMode ?? effectDrivenMode`, where effects like
   Bless and armor-proficiency penalties arm the mode automatically and
   `forcedMode` can override). The redesign splits them:
   - (a) becomes a property of the d20 entry in the ticket: tapping the
     d20 chip cycles `d20 → d20 adv → d20 dis`; no d20 in the ticket = no
     advantage control rendered. Manual pool rolls STOP reading the shared
     armed mode.
   - (b) keeps the existing armed-mode plumbing untouched (do NOT touch
     `effectDrivenMode`/`forcedMode` or the Bless/armor flows), but the
     *manual* arming toggle moves out of the tray to the sheet, next to the
     roll targets it actually affects (small adv/dis toggle in the sheet
     header near the d20 chips; optionally also shift-click = adv /
     alt-click = dis on roll targets). The tray's global segmented control
     is then removed. Regression guard: Bless arming, armor-penalty forced
     disadvantage, and the manual override (including overriding back to
     "normal") must all still work from the sheet.
   (Combat tab keeps its own initiative controls unchanged.)
4. **Result strip**: dedicated area at the top of the Dice tab: Fraunces
   total (~2.1rem), breakdown line (per-group rolls; adv shows both faces
   with kept one bright), and a "reroll ↻" affordance that re-runs the same
   ticket. Empty state: quiet "Ready — build a roll or tap a stat on your
   sheet."
5. **Auto-clear**: after a successful roll, the ticket clears (the result
   strip's reroll preserves the formula). Remove the Clear button entirely.
6. **History**: compact rows (label · formula → total) each with an inline
   reroll ↻ button (re-dispatch through `onRollPool` with the stored groups
   — history entries already carry enough data; extend `RollHistoryEntry`
   with the source groups/modifier if missing).
7. Tests: extend `tests/` with a small unit file for ticket↔formula
   serialisation (pure helpers — extract `ticketToFormula`/`formulaToTicket`
   into `src/lib/diceTicket.ts` so they're testable without JSX).

Acceptance: A's criteria + ticket/formula round-trip tests green; adv still
only affects d20s (existing behaviour preserved); rolling clears the ticket;
reroll reproduces identical group structure.

## Option C — Quick-roll dock (L, ~2–3 days, includes B)

Optimise for actual table play: repeated rolls one tap away.

1. **Favorites (pinned formulas)**: star icon on history rows + "+ pin"
   chip; favorites render as a chip row above the die buttons and roll
   immediately on tap. Persist per character in localStorage
   (`forge-and-fable-dice-favorites:<characterId>`, keep the legacy key
   prefix per repo convention) — no schema change needed. Cap ~8, overflow
   scrolls.
2. **Collapsible builder**: when ≥1 favorite exists the die-chip builder
   collapses behind a "Build a roll" disclosure (open by default when there
   are no favorites). Keeps the tray short on desktop and the bottom sheet
   short on mobile.
3. **Sheet integration polish**: sheet-triggered rolls (stat clicks) light
   the result strip and offer one-tap "pin this roll" — closing the loop the
   empty-state copy already hints at.
4. **Roll animation (restrained)**: ~250ms count-up/settle on the result
   total only — no dice tumble, no glow; fully disabled under
   `prefers-reduced-motion` (media query around the transition class).
5. QA script: extend `QA/tests/` with a Playwright pass (register throwaway
   user pattern from `ao-dashboard.mjs`): build ticket → roll → result strip
   → pin → favorite tap → history reroll; run at 1440px and 390px.

Acceptance: B's criteria + favorites survive reload; reduced-motion honoured;
mobile sheet height stays usable with favorites present.

## Recommendation

Ship **B** as the target (it fixes every observed UX defect), implemented as
A-then-B commits so there's a safe stopping point. C's favorites are the
highest-value follow-up and are independent enough to be a later round.

## Agent implementation contract — Option B (added 2026-07-17)

Scope = Option A + Option B above, exactly. No Option C features (no
favorites, no collapsible builder, no animations beyond what B specifies).

### Order of work
1. `src/lib/diceTicket.ts` — pure module first: `TicketGroup`
   `{ sides, count, keepHighest? }`, `Ticket { groups, modifier,
   d20Mode: "normal" | "advantage" | "disadvantage" }`,
   `ticketToFormula(ticket)`, `formulaToTicket(input)` (wrap the existing
   `parseDiceFormula` — do not reimplement parsing), `addDie`, `removeGroup`,
   `cycleD20Mode`. Unit tests in `tests/diceTicket.test.ts` (round-trip,
   kh preservation, d20Mode only meaningful when a d20 group exists).
2. CSS: append ONE `.ao-dice-*` block at the very end of
   `src/app/arcane-observatory.css`, scoped `[data-theme="arcane-observatory"]`.
   Recipes: matte panel (`--surface-panel` bg, `--border-strong` border,
   `--radius-md`, shadow `inset 0 1px 0 rgba(255,255,255,.025), 0 12px 28px
   rgba(0,0,0,.16)`), recessed wells `--surface-panel-recessed`, blue
   selection `--state-selected` (inset ring, never brass), single brass CTA
   reusing the `.ao-hd-btn-primary` gradient recipe, Fraunces
   (`--font-role-display`) for the result total and Roll label, uppercase
   micro-labels in `--font-role-label` + `--label-tracking`. No blur, glass,
   glow, or bright bloom.
3. RollDrawer restructure per Option B steps 1–6 (ticket row, formula sync,
   d20-chip adv cycling, result strip with reroll, auto-clear after roll,
   history rows with inline reroll). Stop using `glass-button`/`gold-button`
   in this component (leave those classes defined for other consumers).
4. Sheet-side manual adv toggle (Option B step 3b): a small two-state
   adv/dis control near the sheet's d20 roll targets that drives the
   EXISTING `manualRollMode` in ForgeAndFableApp. Do not modify
   `effectDrivenMode`, `forcedMode`, Bless, or armor-penalty logic — only
   relocate where `manualRollMode` is set. Then delete the tray's global
   segmented control.
5. Copy pass: "Disadvantage/Advantage" spelled out where shown; header
   "Dice Tray"; em dashes; empty result strip: "Ready — build a roll or tap
   a stat on your sheet."

### Repo landmines (violating these has bitten previous sessions)
- `arcane-observatory.css` is append-only at file end; after editing, run a
  brace-balance check — one unclosed `@media` silently kills every rule
  after it.
- Other sessions modify this repo concurrently; re-read any file right
  before editing it. Schema revision may have moved (was 20 at write time)
  — irrelevant to this work; do not touch `src/lib/db.ts`.
- The mobile bottom-sheet variant of RollDrawer (≤760px, from mobile pass 2:
  ✕ close, Escape, 44px targets, bottom-nav clearance) must keep working.
- `npm run lint:ci` is zero-warning; Next 16 App Router; do not add
  dependencies.
- Respect `prefers-reduced-motion` for any transition you add.
- Commit the finished work to main in ONE commit (do not push, ever).

### Verification (all required before done)
- `npx tsc --noEmit`, `npm run lint:ci`, `npx vitest run` all green
  (including new diceTicket tests).
- `npm run build`, then `npx next start -p 3013` (the owner's dev server
  may occupy 3000; `next dev` refuses a second instance) and a Playwright
  QA script `QA/tests/dice-tray-b.mjs` modeled on `QA/tests/ao-dashboard.mjs`
  (register throwaway user; flip `users.email_verified = 1` in
  `data/forge.db` via node:sqlite; open a character sheet, open the dice
  tray): build 2d6+1d20 ticket → cycle d20 to advantage → roll → result
  strip shows total + both d20 faces with kept one marked → ticket cleared
  → history reroll works → screenshots at 1440×900 and 390×844 into
  `QA/screenshots/dice-tray-b/`. Kill the :3013 server afterwards.
- Verify sheet flows still arm correctly: a character with the armor
  penalty (or a Blessed one) still rolls STR/DEX checks at forced
  disadvantage from the sheet.

## Files touched (all options)

- `src/components/RollDrawer.tsx` — restructure/re-class (B splits pure
  helpers into `src/lib/diceTicket.ts`).
- `src/app/arcane-observatory.css` — new `.ao-dice-*` block appended at end.
- `tests/diceTicket.test.ts` (B+), `QA/tests/dice-tray.mjs` (C).
- Do NOT touch: `parseDiceFormula`, roll RNG/dispatch, Combat tab logic,
  campaign initiative wiring, history entry persistence.
