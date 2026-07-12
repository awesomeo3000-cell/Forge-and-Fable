# CHANGES DM-4 — Encounter Operations

Implemented the fourth sub-round of `ai-project-proposal-dm-table-complete-workspace.md`.

## Delivered

- Encounter header with current combatant, round, previous turn, next turn, pause/resume, and end encounter.
- Persistent turn operations for jump-to-turn, delay, ready, reaction use, reorder, NPC duplication, NPC initiative reroll, and removal.
- Reaction markers reset at the beginning of a new round.
- Boundary-aware start-turn and end-turn checklists generated from structured encounter reminders.
- Encounter pacing facts for elapsed time, active/defeated enemies, critical/concentrating party members, pending requests, round, and objective.
- Wave readiness derived from round, HP threshold, or combatant defeat without automatically deploying anything.
- Explicit deploy, postpone, and cancel controls; deployment remains DM-authorized and persists in the live encounter run.
- Paused encounter runs remain discoverable and can be resumed after refresh.

## Persistence and safety

- Turn index, round, reaction use, delay/readied state, HP, and visibility remain in the versioned initiative record.
- Encounter pause state and wave decisions remain in the encounter-run live record.
- Player initiative projection continues to strip hidden combatants, private notes, stat blocks, AC, and exact HP unless explicitly revealed.

## Automated verification

- Campaign projection tests cover persistent reaction/readied state and continued secret stripping.
- Encounter-run tests cover pause/resume and explicit wave deployment.
- Reminder trigger tests cover round and turn boundaries.
