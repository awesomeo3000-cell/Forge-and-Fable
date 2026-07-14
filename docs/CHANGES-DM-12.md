# CHANGES-DM-12 — Round Four A2: the encounter log

Date: 2026-07-13
Round: DM Table Round Four, second sub-round (A2), per
docs/ai-project-proposal-26-dm-table-round-four.md. Built and verified
separately from A1 (CHANGES-DM-11).

## What changed

The center region's lower half now carries the session's ledger being
written in real time. Pure presentation + filtering over DMTablePanel's
existing `records` feed (campaign rolls + table events) — no new server
work, no new data in the feed.

- Placement: `.dm-encounter-log` at the bottom of Encounter mode, below the
  initiative list and the command toolkit. Max height 32vh with internal
  scroll; newest first — the top is always current, no auto-scroll
  management. Review mode remains the full chronological record.
- Scope: while an encounter run is active, only records with
  `at >= activeEncounter.startedAt`; a "Show earlier" link lifts the filter
  (and flips to "This encounter only"). No active encounter → session
  scope. The log survives mode/encounter changes — it is a view over the
  persistent feed (`logShowEarlier` is plain UI state).
- Grouping (`groupEncounterLog` in `src/lib/dmTable/encounterLog.ts`, pure
  and unit-tested): rolls that answer one request collapse into a single
  entry — "<label> — N responded: totals…" — expandable (`<details>`) to
  the individual rolls. Matching is the rolls' shared label within a
  5-minute window, walking the newest-first feed; no new server linkage.
  A lone roll stays a plain line; interleaved table events don't split a
  group; a same-label roll outside the window is an earlier request.
- Voice (`logEntryVoice`): announcements render as italic marginalia;
  mechanical events plain ink; death-save events carry the seal tint
  (`--dm-danger`). `eventLine` gained real lines for `death-save-update`
  ("Death save: natural 20." / "Healing applied at 0 HP.") and
  `concentration-end` — both previously fell through to "Table event."
  Ghost records carry the existing italic *rehearsal* mark: on each roll
  line, and on a group summary when every roll in it is a ghost's.
  Note: there is no distinct critical-HP event type in the feed; the seal
  tint rides `death-save-update`, which is where critical-HP moments
  surface as events today.
- Filter: the same all / rolls / table control as Review mode, bound to the
  same `recordFilter` state (explicitly allowed by the proposal).
- Cap: 40 visible entries (a collapsed group counts as one), then a
  "Session review — the full record" link that switches workspace mode.
- Privacy: the feed contains only what players already broadcast plus ghost
  rolls (DM-only by construction). Nothing new was added to it; the
  `records` memo only gained presentation fields (structured roll fields,
  event type, ghost flag) derived from data already on the client.

## Files
- `src/lib/dmTable/encounterLog.ts` — NEW: `LogRecord`/`LogEntry` types,
  `groupEncounterLog`, `logEntryVoice`, `ROLL_GROUP_WINDOW_MS`.
- `tests/dmTableEncounterLog.test.ts` — NEW: grouping windows, lone rolls,
  interleaving, label separation, voice mapping.
- `src/components/DMTablePanel.tsx` — records memo enrichment, `eventLine`
  additions, `logShowEarlier` state, the log section in Encounter mode.
- `src/app/globals.css` — one appended `/* -- DM-12 ... -- */` block;
  `--dm-*` and semantic tokens only.

## Verification
- `npm run build`, `npm test` (264 passing, incl. 6 new grouping/voice
  tests), `npm run lint` (0 errors, pre-existing img warnings only) — green.
- The preview harness still wedges at the app login (known environmental
  issue) and this environment cannot drive the dev server — the grouping,
  scoping, and voice logic is unit-tested at the lib layer; the in-browser
  pass is the owner's: drive a rehearsal encounter (roll requests answered
  by the auto-responder, a condition, an announcement, a rest) and confirm
  the group entry expands to individual rolls, "Show earlier" lifts the
  encounter scope, the announcement reads as italic marginalia, and 40+
  entries produce the Session review link.
