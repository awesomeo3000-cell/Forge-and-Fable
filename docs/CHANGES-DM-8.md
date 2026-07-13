# CHANGES-DM-8 — Content before chrome (Round Two)

Date: 2026-07-13
Round: DM Table reshape, Round Two of three (follows CHANGES-DM-7's
"The Table Is Paper"; agreed direction from that doc's "Next rounds")

## The decision

The Table's chrome collapses to one line. Round One made the surface honest;
this round removes the layout knobs and global bands that sat between the DM
and the content: the four-way view preset, the standalone session strip, and
the always-on active-encounter band.

## What changed

1. **View presets → a single Compact toggle.**
   - `src/components/DMTablePanel.tsx`: the `View` select (Combat / Roleplay /
     Preparation / Compact) is gone. The workspace-mode nav was already the
     real switch; the only thing the presets added was rail density, which is
     now a `Compact` toggle button in the header (persisted as
     `forge-and-fable-dm-compact`; a saved legacy `compact` preset under
     `forge-and-fable-dm-layout` migrates on first read).
   - `src/lib/dmTable/party.ts`: `DmLayoutPreset` and `presetMode()` deleted.
     `DmWorkspaceMode` stays. The matching `presetMode` unit test block was
     removed from `tests/dmTableParty.test.ts`.
   - The workspace opens in Encounter mode (same landing as the old default
     "combat" preset).

2. **Session strip folded into the header line.**
   - The `.dm-session-strip` section below the header is gone. With an active
     session, elapsed minutes and break status render in the header eyebrow
     (`THE TABLE · <title> · 42m · On break`) and the strip's four actions
     (Note, Pin latest, Break/Resume, End session) sit in a `.dm-head-session`
     cluster on the header line. With no session, that cluster is the title
     input plus Start session.
   - Dropped without replacement: the "Starting at <scene>" hint from the
     start-session strip — the active scene is already the first thing Scene
     mode shows.

3. **Active-encounter band lives inside Encounter mode.**
   - The `.dm-live-encounter` section (name/objective, pacing facts, scene
     notes, due reminders, waves, handout/pause/end controls) no longer
     renders above the whole table in every mode. It renders inside the
     Encounter workspace region, directly under the turn header — content in
     the workspace that owns it, not chrome above everything.
   - Restyled from a full-width four-column band to a stacked card
     (`margin-bottom`, full border) sized for the center column.
   - So the DM still knows combat is live from other modes, the Encounter
     button in the mode nav shows a small `.dm-live-dot` (danger red) while
     an encounter run is active.

## Rules for future rounds (unchanged from DM-7, plus)

- The header owns session lifecycle and global switches (mode nav, Compact,
  Tools, Command, Code). Nothing else renders between the header and
  `.dm-table-grid`.
- Mode-specific content renders inside that mode's workspace region only.

## Verification

- `npx tsc --noEmit`: clean.
- `npm test`: pending at write time — an Anthropic-side tooling outage was
  intermittently blocking command execution; the suite covers no removed
  surface beyond the deleted `presetMode` block. Update this line when the
  run completes.

## Next round (agreed direction)

- **Round Three:** tier combatant rows and party cards (essentials visible,
  the rest behind the inspector / an overflow menu); merge requests,
  reminders, and turn checklist into one Attention queue.
