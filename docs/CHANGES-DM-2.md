# CHANGES DM-2 — Character Inspector, Alerts and Presence

Implemented the second sub-round of `ai-project-proposal-dm-table-complete-workspace.md`.

## Delivered

- Presence heartbeats with active, idle, and offline states derived on the server.
- Visibility-aware campaign sync plus a page-exit offline beacon.
- A party readiness summary showing connected, ready, and attention-needed counts.
- Deterministic, deduplicated alerts for low HP, unconscious characters, death saves, concentration, and expended critical resources.
- Alert-to-character navigation in the party rail.
- Private, DM-only character notes with categorized persistence and bounded input.
- Inspector Notes and History tabs backed by campaign data rather than local component state.
- Database revision 8 with presence and character-note tables, indexes, and migration tracking.

## Privacy and ownership

- Presence can be read by campaign members, but only the authenticated member's own heartbeat can be changed.
- Character notes can only be listed or mutated by the campaign DM.
- Derived alerts remain read-only and do not write character state.

## Automated verification

- Presence lifecycle tests cover active, idle, and offline transitions.
- Note tests cover DM access, player denial, creation, updates, and deletion.
- Alert tests cover deterministic output and deduplication.
- Campaign integration tests confirm the schema revision and existing campaign behavior.
- Typecheck, zero-warning lint, and the focused DM/campaign test suite pass.
