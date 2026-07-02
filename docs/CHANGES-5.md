# CHANGES-5 — Round 5 Audit Trail

## DeepSeek tasks 5.1–5.4 (reviewed & verified by Claude; DeepSeek omitted this log)

- **5.1 Initiative click-to-roll** — Init vital is a button; verified a d20 flies with the modifier and the roll lands in the history log.
- **5.2 Functional rests** — long rest confirms then restores HP/temp HP/slots/concentration/hit dice in one patch; short rest resets pact slots; both report via the new `onNotify` → status chip.
- **5.3 Inspiration toggle** — persisted `heroicInspiration` boolean, muted default, accent when on.
- **5.4 Death-save dots** — 14×14px.

## Round 5.5 (Claude) — remaining items

- **Roll history log + ad-hoc dice pool (RollDrawer.tsx):** right-edge drawer with a
  pool builder (d4–d100, up to 20 each, ±modifier) and a session log of every roll —
  sheet clicks included — capped at 30 entries with per-die breakdowns and timestamps.
  `pushPool()` in ForgeAndFableApp rolls mixed pools as one flight of dice and one log
  entry. Verified: 2d6+1d20+2 → "2d6 [3, 4] + 1d20 [10] +2 = 19"; Initiative click logged.
  Removed the orphaned DiceTray.tsx (never rendered).
- **Icon cleanup:** removed the lucide icons from Short Rest / Long Rest / Inspiration
  and the Features/Traits/Spells/Inventory tabs; buttons are now typography-only
  (inspiration shows a ✦ glyph when active).
- **Module visibility (edit mode):** every draggable section header gets a "Hide"
  button; hidden sections show as ghost cards with "Show" while editing and disappear
  otherwise. Stored in `sheetLayout.hidden`; verified persistence across restart.
- **Column resizing (edit mode):** drag the divider between columns; widths persist as
  percentages in `sheetLayout.columnWidths` (normalized to 100, min 12% per column,
  disabled in the stacked mobile layout, garbage values rejected on load). Verified a
  +100px drag → 23.7/30.1/46.3 persisted across restart. Fixed en route: dividers as
  siblings broke the `:nth-child` column width rules — they now live inside the columns.
- **Font system fix (root-cause of "different fonts across modules"):** `:root`
  redefined the next/font variables in terms of themselves (`--font-archivo:
  var(--font-archivo), ...`) — a custom-property cycle that invalidated
  `--font-display/body/label` document-wide, so the 3-font hierarchy never actually
  applied and skinned sheets flattened to one face. Aliases now reference the font
  variables without self-reference, and themes only override body+display (labels stay
  Archivo for legibility, console stays mono). Verified under Necromancer: name =
  blackletter, labels = Archivo, body = blackletter.
