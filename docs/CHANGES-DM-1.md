# CHANGES DM-1 — Table shell and Party Command Center

Implemented the first sub-round of `ai-project-proposal-dm-table-complete-workspace.md`.

## Delivered

- Four primary Table modes: Scene, Encounter, Preparation, and Session Review.
- Combat, Roleplay, Preparation, and Compact view presets persisted per browser.
- A three-zone desktop shell with a 310px party rail, flexible center workspace, and 390px inspector at 1440px.
- An accessible party command rail with exact HP, a thick labeled progress bar, temp HP, AC, passive Perception, speed, conditions, concentration, death saves, Inspiration, hit dice, and compact spell slots.
- A contextual inspector with Overview, Sheet, Notes, and History tabs plus explicit roll, note, and full-sheet actions.
- The existing read-only `HeroSheet` remains the canonical full sheet.
- Campaign sync summaries now expose bounded DM operational fields rather than requiring each component to recalculate them.

## Browser verification

- Created and opened a fresh local DM campaign through the real onboarding flow.
- Confirmed all four modes, the view preset selector, party rail, central encounter workspace, inspector empty state, tools, soundboard, and command controls render without console-visible runtime failure.
- At 1440×900 the measured columns are 310px / 675px / 390px with no horizontal document overflow.
- At 1280px the inspector becomes an overlay and the center remains usable.

## Automated verification

- Focused campaign store and role tests pass.
- New pure tests cover HP severity, source-backed resource adapters, and preset-to-mode mapping.
- Typecheck, zero-warning lint, and production build pass.
