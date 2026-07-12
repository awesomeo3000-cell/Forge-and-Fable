# CHANGES DM-6 — Loot, Session Lifecycle, Command Palette and Layout Polish

Implemented the sixth sub-round of `ai-project-proposal-dm-table-complete-workspace.md`.

## Delivered

- Persistent loot parcels with unclaimed, offered, accepted, declined, partially assigned, and resolved item states.
- Targeted loot proposals; the owning player must explicitly accept before the item is added to the enrolled character inventory.
- An always-visible session strip for starting sessions, selecting the current starting scene, elapsed time, notes, latest-event pinning, breaks, and ending a session.
- End-session handoff opens the existing editable summary workflow; existing session pins continue to seed the draft and nothing is auto-published.
- A fuzzy Ctrl/Cmd+K palette with keyboard navigation, contextual disabled states, common Table commands, mode switching, and licensed rules references.
- All palette actions remain available through visible Table controls.
- A dismissible four-step first-use guide.
- Persistent layout presets from DM-1 remain the source of view preference, with final responsive styling for new scene, encounter, loot, session, and command surfaces.
- Database revision 11 adds campaign-scoped loot parcels.

## Ownership and safety

- The DM offers loot but cannot write another user's inventory.
- Only the targeted campaign member can accept or decline an open offer.
- Accepted inventory changes are applied through the owning player's existing character-save coordinator.
- Session summaries remain DM-edited drafts until the explicit existing publish action.

## Automated verification

- Loot tests cover enrolled targeting, non-target denial, acceptance, and parcel resolution.
- Schema and health tests cover revision 11.
- Typecheck, zero-warning lint, focused campaign/DM tests, and production build pass.
