# CHANGES-29 — roll requests, copy feedback, join button, condition mechanics (reviewer)

Five owner-reported campaign fixes.

## 1. Copy confirmation
Copying a campaign code gave no feedback. Both copy paths now confirm:
- `DMTablePanel` code button → "Copied ✓" for 1.6s (accent), reverts.
- `CampaignPanel` create-screen "Copy" and detail code badge → same.
- Clipboard failure now surfaces "Could not copy — copy it by hand" instead
  of silently swallowing.

## 2. Join button
The list-view Join was a small secondary `glass-button` beside the primary
"New Campaign". For a player, joining IS the primary action — it's now
`dj-btn dj-btn-primary` and reads "Join a Campaign".

## 3–4. Roll requests (DM screen)
New `src/lib/rollRequest.ts` (with tests) centralizes request semantics.
- **Advantage / disadvantage** selector added to the DM roll form
  (Straight roll / Advantage / Disadvantage). It rides the payload as
  `advantage` and, on the player, combines with the character's own
  effect-driven mode under the 5e cancel rule (`combineRollModes`), then is
  forced through `pushPool` (new optional `forcedMode` param).
- **Auto-description**: the DM prompt is now optional; every request names
  itself from its mechanics — "Perception check", "Wisdom saving throw",
  "Initiative" (`rollRequestDescriptor`). The player toast, the roll label,
  the resolved status line, and the DM's Record all use it.
- **DC reveal is now a choice**: a "Show DC to players" checkbox (appears once
  a DC is typed). A hidden DC is **never sent to the player's client** — the
  payload omits it entirely; the player rolls blind and the DM reads the total
  (labeled with what it was + adv/dis) in the Record. A revealed DC still
  shows the pass/fail line.

## 5. Status/effects tie into the sheet and rolls
Verified end to end (was already wired; now covered):
- The DM condition form — presets and custom — carries `advantageMode`,
  `stack`, `d20Dice`, numeric fields (ac/attack/damage/saves/checks/
  initiative) and `sense` on the `condition-apply` payload.
- The player applies it as a `source: "DM"`, `active: true` effect on the
  character; `validateCharacter` accepts every one of those fields (source
  ≤24 chars), so it persists.
- The effects engine (`effectiveAdvantageMode`, `effectTotal`,
  `activeD20Riders`) reads active effects regardless of source, so pushed
  conditions modify rolls exactly like self-applied ones — and now also
  combine with a roll request's requested advantage.

## Verification
- `npm run build` clean; `npm test` **140/140** (+11: new `rollRequest.test.ts`
  covers descriptor/mode/summary/cancel-rule); `npm run typecheck` clean;
  `npm run lint:ci` 0 warnings.
- Browser login wedges in this environment (standing issue) — owner checklist:
  as DM open a campaign → Prepare not needed; use the command row → Request a
  roll: pick Save → Wisdom, Disadvantage, type DC 15, leave "Show DC" off →
  the target player gets a toast "Wisdom saving throw · with disadvantage",
  their panel Roll applies WIS save mod at disadvantage and reports only the
  total; tick "Show DC" and the player sees pass/fail. Copy the code → button
  says Copied. Poison a player from Conditions → their sheet shows Poisoned
  and their d20s roll at disadvantage.
