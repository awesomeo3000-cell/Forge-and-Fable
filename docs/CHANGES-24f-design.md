# CHANGES-24f — The Table design pass (reviewer-applied)

The 24a–e base was functionally complete and architecturally faithful (the
strip's audio arming/reconciliation is exactly per spec — credit where due).
This pass adds the design layer and three UX corrections.

## UX corrections (not just paint)
1. **Turn controls existed nowhere.** The Table now has `Round N` + a
   **Next turn** button in the Encounter header (wraps to round+1, versioned
   initiative write), and the tracker marks the current combatant with the
   accent rule — the DM previously had no way to advance combat from the DM
   surface at all.
2. **The stacked always-open forms are gone** (proposal 24c had explicitly
   called for this). One command row — Announce · Request a roll · Condition ·
   Handout · Add combatant · Short rest · Long rest — with a single disclosure
   form open at a time (`aria-expanded`), closing on successful send.
3. **The player strip now knows whose turn it is:** new `currentUserId` prop;
   your turn renders "YOUR TURN" with an accent-tinted strip instead of your
   own name in passing.

## Design layer
- `DMTablePanel.tsx`: tracker displays initiative-DESC (matching the
  turnIndex convention used by the player-side "your turn" detection —
  previously rendered unsorted, so turn marking would have been wrong);
  hidden combatants show a dashed `??` chip with reveal-on-click title text;
  party HP bars get a real track + `is-low` state (≤25% → rust); record
  filters get an active state + `aria-pressed`; playing track gets an accent
  rule + NOW PLAYING chip; buttons classified (`dm-btn`/`dm-btn-primary`/
  `dm-icon-btn`) instead of one generic border-everything rule.
- `globals.css` R24 block rewritten in place (~525 lines): the desk idiom —
  dark `--ground-2` surface with grain framing the party's paper, registry
  double-rule under the header, three-face type system throughout
  (`--font-label` for all caps chrome, body for names/values, display for
  the campaign title), hairline rows everywhere, one accent. Inline forms
  are hairline-bottom inputs in a quiet tray; empty states are ghost italic.
- Campaign theme still arrives via `--paper`/`--ink`/`--doc-accent` from the
  panel's inline vars; every rule keeps dark-desk fallbacks.

## Verification
- `npm run build` clean; `npm test` 122/122; lint clean.
- Two-chair runtime pass is the owner's (preview harness login-wedge,
  standing issue): as DM — regions render, Next turn advances and wraps with
  round increment, current-combatant rule follows, hidden `??` chip toggles,
  command row opens one form at a time, party HP bar drops when a player
  takes damage, playing track shows NOW PLAYING. As player — strip shows
  YOUR TURN on your turn, audio chip unchanged.
