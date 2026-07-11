# CHANGES-26 — campaigns v2 review (reviewer)

Full review of 24a–f + CHANGES-25. Verdict: **approved with one fix** —
the strongest multi-round stretch this project has had.

## Fixed during review
- **`statBlock` leaked to players.** `visibleInitiative` stripped
  `privateNote` and `conditions` but not `statBlock` (saves, resistances,
  immunities — DM secrets even on visible combatants). CHANGES-25 claimed it
  was stripped; the code and its tests disagreed — the test asserted the
  other two fields and never checked this one. One-line strip added +
  regression assertions both ways (player: undefined; DM: intact).
  `npm test` 122/122, build clean.

## Verified sound
- Hidden combatants filtered server-side, with tests; player `turnIndex`
  remapped to the filtered list.
- Player HP/AC derived from members, never stored in the encounter (single
  source of truth held).
- Versioned writes on initiative and audio; DM-only writes on tracks/audio.
- Audio arming, state-driven reconciliation, loop-seek, cue dedup all per
  proposal 24b.
- Backward-compat combatant migration (isPlayer/nested hp/note) on PUT.
- The Table takeover is `position: fixed` (the "button does nothing" bug —
  fixed with a comment explaining why it must not re-enter document flow).

## Noted for a future cleanup round (not blocking)
1. If the CURRENT combatant is hidden, the player-side `turnIndex` clamps to
   0 — the top visible row can read as "their turn" falsely. Consider
   remapping to the next VISIBLE combatant in order, or a sentinel the strip
   treats as "—".
2. Tracks/audio routes derive 403 by matching "DM" in error message strings —
   works, brittle. A typed error (like `CampaignConflictError`) would be safer.
3. Music start/stop isn't logged in The Record (their own documented limit) —
   one event emission if the table wants it.

## Remaining before/after 1.0 (state of the world)
- **R23 gate still unrun** (`CHANGES-23` does not exist): revision-conflict,
  migration-adoption, backup/restore verification + the initiative 400→409
  alignment. Do before tagging.
- The one real two-chair session every 24x changelog honestly defers to.
- §7 human items: full manual pass, SRD licensing check, README, tag 1.0.
