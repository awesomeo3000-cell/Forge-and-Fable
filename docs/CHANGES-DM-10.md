# CHANGES-DM-10 — Round Three, stage one: legibility, artifacts, lifecycles

Date: 2026-07-13
Round: DM Table reshape, Round Three (first stage), led by Fable and applied
partly via owner-run patch scripts during the day's tooling outage.
Driven by owner feedback on the Round Two build (six points) plus the open
DM-9 review findings.

## What changed

### Legibility — "numbers are the loudest thing after names"
- Party cards grew an always-visible `.dm-vitals-strip`: AC / PP / Speed as
  muted small-caps labels with ink-weight tabular numerals. The old
  `.dm-command-vitals` muted one-liner is gone from the card.
- Initiative rows: `.dm-combatant-ac` and the HP input render in ink at
  weight 600 instead of small muted gray.

### Portraits as the focal point
- Rail portraits 54→76px (column 80px), inspector 58→84px; 60px on ≤800px
  viewports.

### Fantasy through artifacts, not palette
- Class sigils: each party card carries its class icon
  (`public/class-icons/*.svg`) as a ~7% opacity ink watermark, bottom-right
  (`.dm-class-sigil`); slightly stronger on the selected card.
- The campaign accent now works for a living: active workspace-mode tab
  carries an accent underline; the current-turn combatant row gets an accent
  left rule + 7% wash (a wax-seal bookmark, not a highlighter).
- Parchment grain on the Table raised from 2.5% to 5%.

### Lifecycles (owner: "the boxes never go away" / "can't remove alerts")
- Request cards: open cards stay; completed cards linger 120s after
  `resolvedAt` then retire; every card has a dismiss (×). Server-side
  Withdraw for unanswered requests is specced for the crew
  (ai-project-proposal-25).
- Party alerts: per-alert acknowledge (×). Acknowledgement is keyed to the
  alert's title+detail signature, so a re-wounded character re-alerts.
- Ghosts count as present: no more ×4 "disconnected" alert spam, presence
  label reads "rehearsal", readiness counts them (DM-9 finding 1).
- Encounter mode's duplicate reminder surfaces merged: the relocated band's
  `dm-upcoming` block was removed; the turn checklist rows gained
  Snooze / Record (DM-9 finding 3).

### Rehearsal control relocated (owner: "ugly and out of place")
- The header chip is gone. "Seat a rehearsal party" lives in the party
  rail's empty state — the only moment you want ghosts is when the rail is
  empty — and the rail header's "Rehearsal party ×" mark clears it. Both are
  also Ctrl/Cmd+K palette commands.

## The gray-slab incident (worth remembering)

Stage one initially rendered the card summary as a solid `#6b6b6b` block.
Cause: the sigil `<img>` was inserted BEFORE the card's main button, which is
styled via `.dm-command-member>button:first-child` — the selector stopped
matching, the button lost all styling including `background:transparent`,
and the UA's dark-scheme ButtonFace showed through. Diagnosis was confused
by a color-transforming browser extension on the owner's profile that
repainted the whole card dark in normal windows. The sigil now renders after
the buttons (absolute positioning makes DOM order irrelevant), with a
comment in PartyRail.tsx warning about the first-child dependency.

## Verification

- `npm run build`: compiled + TypeScript clean.
- `npm test`: 252/252 (also closes the DM-8/DM-9 ship-time gap).
- Owner-eyeballed on true rendering after the extension/first-child
  confusions were resolved.

## Remaining Round Three (stage two, Fable)

- Inspector portrait plate; combatant-row tiering (Turn/R visible, the rest
  behind an overflow menu); artifact refinements after owner review of
  stage one on honest rendering.
- Crew server work specced in docs/ai-project-proposal-25.
