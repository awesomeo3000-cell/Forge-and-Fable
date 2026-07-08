# Forge & Fable — Round 14: QA P2/P3 sweep, accessibility completion, empty states

**Audience:** DeepSeek-class agent, fresh session. Follow this document exactly; where a judgment call would be needed, the decision is already written here — do not substitute your own.
**Read first:** `docs/ROADMAP-1.0.md` §0 (process + landmines). Current state: R10–R13 done; storage is SQLite (`data/forge.db`), auth is httpOnly cookie `ff_session`.
**Before starting:** `git add -A && git commit -m "pre-R14 checkpoint"`.

## Task 1 — QA P2/P3 triage & fix

The audit `docs/QA-REPORT-2026-07-04.md` lists 14 P2 + 18 P3 issues spread across its per-agent sections (search the file for `P2` / `P3` table rows in each section).

**Procedure — follow mechanically for EVERY P2/P3 row:**
1. Copy the issue into `docs/CHANGES-14.md` with its report location.
2. Re-verify against CURRENT code (the report is from 2026-07-04; rounds 9–13 fixed or obsoleted many items, and the report also contains self-inflicted findings — see the roadmap caveat). Classify as one of:
   - `ALREADY FIXED` (name the round that fixed it),
   - `STALE` (describes code that no longer exists),
   - `WONTFIX` (only if this doc says so below),
   - `OPEN` → fix it.
3. For `OPEN` items: smallest possible fix, verified in the running app, one changelog entry each.

Known classifications to save you time (verify anyway, one line each):
- "Background skills display-only" → ALREADY FIXED (R9).
- "Subspecies flat-listed" → ALREADY FIXED (subspecies rounds).
- "Premade archetypes are placeholders" → ALREADY FIXED (round 2 of the older numbering; premades forge real characters).
- "Manual HP mode silently behaves as fixed" → OPEN; fix = in `LevelUpModal`, when `settings.hitPointType === "manual"`, replace the roll button with a number input (1..hitDie+CON, min 1) whose value feeds the same `hpGained` path. Verify by leveling with both settings.
- "Race traits are descriptive only (no mechanical darkvision etc.)" → WONTFIX this round: mechanical traits belong to the effects engine; add ONE bridge instead — on character creation, if the species has a trait named "Darkvision", auto-add a `Darkvision 60 ft.` sense effect (active) via the existing `effects` field. Nothing else.
- Lint/dep nits (unused `_drop`, stale eslint-disable, extraneous package) → OPEN, trivial; do them.
- ".env missing / railway.json lacks FORGE_VAULT_DIR" → OPEN: add `.env.example` (never a real `.env`) documenting `JWT_SECRET`, `REGISTRATION_CODE`, `FORGE_VAULT_DIR`; add the var to `railway.json` if that file exists.

## Task 2 — Accessibility completion (checklist; each line is verify-then-fix)

Work through this list; for each item the changelog states pass/fixed:
1. Every modal (`LevelUpModal`, `ClassLearnModal`, `SpeciesLearnModal`, `AppearancePanel`, `FeedbackModal`, spell-detail overlay, AC-breakdown overlay) closes on Escape and returns focus to the element that opened it.
2. Tab is trapped inside open modals (focus cycles within; Shift+Tab from first goes to last). Implement one small reusable hook (`useFocusTrap(ref, active)`) rather than seven copies.
3. The save-proficiency toggle currently requires right-click (`onContextMenu`) — add a keyboard path: focused save row toggles proficiency on `p` keypress, and add this hint to its `title`/`aria-label`.
4. All icon-only buttons have `aria-label` (sweep: grep `<button` lines lacking text content — drag handles, steppers, close ×, dice buttons, page-block removers).
5. Slot pips, death-save dots, effect toggles, prepared markers: verify `aria-label`/`aria-pressed` present (most added in earlier rounds — verify, fix stragglers).
6. Contrast: with the DEFAULT skin and each of the two darkest presets (Necromancer, Infernal Pact), check the sheet's small-caps labels and `cs-muted` text against their backgrounds ≥ 4.5:1 (use a contrast tool or the Appearance panel's own `contrastRatio`); adjust the preset's `ink`/`accent` values minimally if any fail — do not touch the CSS system.
7. `prefers-reduced-motion`: verify the existing media query still covers the dice overlay and drawer transitions (it exists in globals.css; confirm nothing added since R6 ignores it — notably dossier rail transitions and page tab switches).

## Task 3 — Empty & error states sweep

Every list/collection surface gets a designed empty state (one styled line, `cs-muted`/`dj-` idiom — NOT a bare blank area). Sweep these and fix any that render blank: vault rail (no characters — exists, verify), inventory tab, spells tab (non-caster — tab hides, verify that's still true), effects list (exists), pages (exists), roll history (exists), attacks (exists), user skin presets (panel with none saved), Quickbuilder grids with a missing ruleset id, feedback list if any. Error toasts: confirm every fetch failure path routes through the status chip (grep `catch` blocks in `ForgeAndFableApp.tsx` for silent ones).

## Constraints
- No new dependencies. No schema/API changes. No visual redesigns — this is a polish round.
- globals.css: append only. All landmines in roadmap §0 apply.

## Verification & deliverable
`npm run lint` (0 errors) + `npm run build` after each task. Full keyboard-only session at the end: register → build a character → level up → roll → logout, mouse untouched — note in the changelog where keyboard-only fails (fix if in scope, log if architectural). `docs/CHANGES-14.md` with the full triage table + per-item entries. No entry = not done.
