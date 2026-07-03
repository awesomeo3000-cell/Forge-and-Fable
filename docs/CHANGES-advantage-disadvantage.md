# Changes — Advantage / Disadvantage rolling

Adds one-click advantage/disadvantage to every d20 check, attack, save, skill, and
initiative roll. Advantage rolls 2d20 and keeps the higher; disadvantage keeps the
lower; the modifier applies to the kept die. The two faces show in the drawer history
with the kept die highlighted and the dropped one struck through.

## Behavior

- A 3-way mode toggle (**Dis / Normal / Adv**) sits in the roll drawer's pool area.
- The mode is **one-shot**: arming Adv/Dis affects the *next* d20 roll, then resets to
  Normal automatically. This prevents an armed mode from silently corrupting later
  rolls (the main risk of a sticky toggle).
- When armed, the closed drawer tab shows a colored dot (green = adv, red = dis) so the
  state is visible even with the drawer collapsed, plus an inline "Next d20 roll uses
  advantage/disadvantage" hint.
- Rider dice (e.g. Bless's 1d4) still fly and add to the total, unchanged — they ride
  the kept d20.
- **Damage and hit-die rolls are unaffected** — only single-d20 check/attack/save rolls
  route through the advantage path.

## Areas changed

- `src/types/game.ts` — new `RollMode = "normal" | "advantage" | "disadvantage"`.
- `src/components/ForgeAndFableApp.tsx` — `rollMode` state; new `pushD20(label, modifier,
  riders)` that rolls 1 or 2 d20s, picks the kept die (max for adv, min for dis), flies
  both d20s + riders in one flight, totals `keptD20 + riderSum + modifier`, records
  history/console, and resets the mode after a non-normal roll. `recordHistory` now takes
  an optional `adv` payload. Drawer gets `rollMode`/`onRollModeChange`; the sheet gets
  `onRollD20`.
- `src/components/HeroSheet.tsx` — `rollD20()` now prefers the new `onRollD20` path
  (passing active rider dice), falling back to the old pool/single-roll behavior when the
  prop is absent. All existing d20 call sites (initiative, ability checks, saves, skills,
  weapon/spell attacks) already funneled through `rollD20`, so they inherit adv/dis with
  no per-site changes.
- `src/components/DiceRollOverlay.tsx` — `RollingDie.dropped?` renders the discarded d20
  dimmed. The nat-20 crit banner now **excludes dropped dice**, so a disadvantage roll
  whose *dropped* die was a 20 no longer fires a false crit.
- `src/components/RollDrawer.tsx` — `RollHistoryEntry.adv?` ({mode, dice, keptIndex}); the
  mode toggle, armed tab dot, and the kept/dropped dice row + ADV/DIS badge in history.
- `src/app/globals.css` — appended `.roll-mode*`, `.roll-tab-dot*`, `.roll-history-die*`,
  `.roll-history-badge*`, `.flying-die.dropped` using the drawer's theme tokens
  (`--roll-accent/-ink/-paper`) plus fixed green/red semantics for adv/dis.

## Verification (in the running app, port 3005, production build)

- `npx tsc --noEmit` clean; `npm run build` passes; eslint clean on the four changed files.
- Registered a disposable account, quick-built an Elf Fighter, opened the sheet + drawer.
- **Advantage:** armed Adv, rolled Athletics (+2) → history "d20 adv [1, 18] keep 18 +2 =
  20"; die `18` shown kept (bold, accent), `1` dropped (struck through, dimmed); total 20;
  mode auto-reset to Normal.
- **Disadvantage:** armed Dis, rolled a save (+4) → "d20 dis [17, 4] keep 4 +4 = 8"; `4`
  kept, `17` dropped; kept die is the lower one; total 8.
- **Normal:** ability check → single die "d20 [13] +2 = 15", no badge, no dice row.
- Armed-state indicators (hint, tab `armed` class, `roll-tab-dot advantage`) confirmed via
  DOM; kept/dropped styling confirmed via computed CSS (font-weight 700 + accent bg on
  kept; opacity 0.7 + line-through on dropped). No console errors.

## Deviations / notes

- Screenshots could not be captured in this session (the preview screenshot call timed out
  repeatedly while the DOM stayed fully responsive to scripted inspection); verification was
  done via accessibility snapshot, DOM state, and computed styles instead.
- The mode toggle governs sheet d20 rolls only; the drawer's ad-hoc pool builder ignores it
  (a pool is not a single d20 check). An armed mode persists until a d20 roll consumes it.
- Left one disposable verification account (`advdis-verify2@example.test`) + its Elf Fighter
  in the local vault, consistent with prior rounds' verification accounts.
