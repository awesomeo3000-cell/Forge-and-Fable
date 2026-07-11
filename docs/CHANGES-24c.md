# Changes 24c — Encounter control and DM commands

## Delivered

- Initiative combatants support DM-only HP, AC, a private note, and a hidden flag.
- Non-DM campaign sync removes hidden combatants on the server before the payload is returned.
- The Table provides combatant creation, HP edits, reveal/hide, removal, announcements, rests, roll requests, condition events, and handout dispatch.
- Initiative and audio writes remain versioned, preserving the existing conflict path for concurrent DM edits.

## Verification

- Campaign v2 tests assert that a hidden combatant is present for the DM and absent for a player sync response.
- Manual two-chair verification remains required for reveal-mid-round and the visible 409/retry experience under concurrent DM edits.
