# CHANGES DM-3 — Roll Requests, Concentration, Death Saves and Rests

Implemented the third sub-round of `ai-project-proposal-dm-table-complete-workspace.md`.

## Delivered

- Durable roll/rest request records with selected, excluded, single-player, and everyone targeting.
- Individual, group-check, and best-result resolution modes with per-player waiting and response states.
- Eight quick roll presets, explicit advantage/disadvantage, optional revealed DCs, and repeat-after-resolution.
- Player rolls continue to use the actually enrolled character, including proficiency, expertise, effects, and requested roll mode.
- Concentration checks calculate `max(10, floor(damage / 2))`, create a Constitution-save request, and never silently remove concentration.
- Targeted owner-client events for ending concentration and recording death-save outcomes.
- Death-save behavior covers a natural 20, natural 1, three successes, three failures, stabilization, healing, reset, and marking dead.
- Rest previews and per-player completion summaries.
- Shared long-rest recovery logic is now used by both the character sheet and campaign-event path.
- Database revision 9 adds bounded request and response tables.

## Ownership and safety

- The DM creates requests but cannot directly patch a player's character.
- Roll, rest, concentration, and death-save changes are performed by the owning player client through validated character updates.
- Request responses are accepted only from targeted campaign members.
- Repeating a request is available only after the prior request resolves, preventing duplicate unresolved cards.

## Automated verification

- Request-store tests cover targeting, response ownership, totals, pass/fail state, and completion.
- Death-save tests cover natural 1, natural 20, healing, and terminal failure behavior.
- Typecheck and zero-warning lint pass.
