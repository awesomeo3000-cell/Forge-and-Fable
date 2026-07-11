# Changes 24a — The Table and party summaries

## Delivered

- A DM opening a campaign now enters the full-screen **The Table** surface; players retain the existing campaign panel.
- The Party region refreshes from the existing campaign sync cadence and shows each member's name, live HP bar, AC, passive Perception, current DM-visible conditions, and remaining spell slots.
- A DM can open an enrolled character's read-only sheet from the party row.
- Campaign sync returns summaries by default. Full character JSON remains limited to the DM and the owning player.

## Verification

- Automated campaign v2 tests cover the sync-path access boundary.
- Manual two-chair browser verification remains required: change a player's HP/effect and confirm it reaches the DM after one campaign poll.
