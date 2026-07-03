# CHANGES-9 — Tier 1 Rules Polish (Backgrounds, Crit/Fumble, Half-Feats)

## Feature 1 — Backgrounds that grant skills

### What changed

**`src/lib/srd.ts`** — Added `BACKGROUND_SKILLS` table mapping each non-custom background to its SRD skill pair:
- Acolyte → Insight, Religion
- Criminal → Deception, Stealth
- Sage → Arcana, History
- Soldier → Athletics, Intimidation

**`src/components/HeroSheet.tsx`** — Three changes:
1. `isSkillProficient` now unions `skillProficiencies` with `BACKGROUND_SKILLS[character.background]` — background skills show as proficient and add proficiency bonus without being written to the persisted skill list.
2. `toggleSkillProficiency` is a no-op for background-granted skills (cannot unintentionally remove a background skill).
3. A small "BG" chip (`cs-skill-bg-chip`) appears next to skill names that are background-granted, so the player knows the proficiency source.

Passive Perception/Insight/Investigation derive from `skillBonus` which already calls `isSkillProficient` — no change needed; they update for free.

**`src/components/CreatorPanel.tsx`** — In the Origin step, when a background is selected, a read-only row of skill chips appears below the DossierStamp showing "Grants: Insight, Religion" (etc.). The chips use the existing `dj-skill-chip.picked` class with `pointer-events: none`. No new draft field needed.

**`src/app/globals.css`** — Added `.cs-skill-bg-chip` and `.dj-background-skills` styling using theme tokens (`--gold`).

### Design decision: derived union, not a silent write

Background skills are *derived* from `character.background`, not written into `skillProficiencies`. This means:
- No new persistence field or `validateCharacter` change.
- Switching backgrounds immediately updates the effective proficient set.
- Manual skill picks are never silently overwritten or double-counted.
- "Custom Background" grants nothing (no entry in `BACKGROUND_SKILLS`).

### Verification

- Acolyte character: Insight and Religion show as proficient (dot filled + proficiency bonus in total) without clicking them.
- Passive Insight/Investigation/Perception rise by the proficiency bonus for background-granted skills.
- Manually picking Insight from the class picker does not double-add — already proficient once.
- Switching to Custom Background removes the auto-grants.
- A skill manually picked that isn't in the background persists after switching away from a granting background.
- `npm run lint` and `npm run build` clean.

---

## Feature 2 — Critical hit / fumble flair (nat 20 / nat 1)

### What changed

**`src/components/RollDrawer.tsx`** — Extended `RollHistoryEntry` with an optional `nat?: "crit" | "fumble"` field. History rows now render a "NAT 20" (gold) or "NAT 1" (muted red) chip alongside the existing ADV/DIS badge, using the same `roll-history-badge` styling pattern.

**`src/components/ForgeAndFableApp.tsx`** — Three changes:
1. `recordHistory` now accepts a 5th parameter `nat?: RollHistoryEntry["nat"]` and stores it on the history entry.
2. `pushD20` detects the kept d20 face: 20 → `"crit"`, 1 → `"fumble"`, and passes it to `recordHistory`. A dropped 20 (disadvantage) is never flagged as a crit, and a dropped 1 (advantage) is never flagged as a fumble.
3. `pushRoll` detects nat 20/1 when `sides === 20 && count === 1` and passes the `nat` to `recordHistory`. Damage dice, hit dice, and multi-die pools are never flagged.

**`src/components/DiceRollOverlay.tsx`** — Four changes:
1. Added `isFumble` prop to `D20Object` — when true, the up-face gets the `is-fumble` CSS class (desaturated/cracked appearance).
2. Added `FumbleBanner` component — a restrained "FUMBLE" banner mirroring `ClarebearCrit`'s timing but using muted theme-token colors (`--ink-faint`, `--ground-3`) so it stays readable on dark skins.
3. `DiceRollOverlay` now filters for fumble dice (`sides === 20 && result === 1 && !dropped`) and renders `FumbleBanner` for each.
4. `FlyingDie` passes `isFumble={die.result === 1}` to `D20Object`.

**`src/app/globals.css`** — Added `.d20-face.is-fumble`, `.fumble-banner`, `.fumble-text`, and `.roll-history-badge.nat` with `.crit`/`.fumble` variants. The fumble banner reuses `crit-bg-pulse` and `crit-flash` keyframes but with desaturated colors.

### Landmines avoided

- A nat-1 on a dropped die during advantage is not a fumble (filtered by `!d.dropped`).
- A nat-20 on a dropped die during disadvantage is not a crit (same filter).
- The crit/fumble detection is purely cosmetic — it does not change totals or auto-apply damage.
- Damage rolls, hit dice, and multi-die pools never show a nat chip.

### Verification

- Rolled d20 until nat 20 appeared: crit banner + `is-crit` face highlight confirmed; "NAT 20" chip in history.
- Rolled d20 until nat 1 appeared: fumble banner + `is-fumble` face highlight confirmed; "NAT 1" chip in history.
- Advantage roll `[1, 20] keep 20`: crit banner fires, no fumble banner; history shows ADV + NAT 20.
- Disadvantage roll `[1, 20] keep 1`: fumble banner fires, no crit banner; history shows DIS + NAT 1.
- Damage roll (2d6): no nat chip in history.
- `npm run lint` and `npm run build` clean.

---

## Feature 3 — Half-feat ability choice (STR or DEX, etc.)

### What changed

**`src/types/game.ts`** — Extended the feat `ASIChoice` variant with an optional `abilityChoice?: AbilityKey`. Existing saved characters without this field remain valid.

**`src/lib/featBonuses.ts`** — `computeFeatBonuses` now honors `choice.abilityChoice` for `chooseAbility` feats instead of always defaulting to `feat.abilityBonuses[0]`. The fallback to the first-listed ability is preserved for backward compatibility (characters saved before this change).

**`src/components/LevelUpModal.tsx`** — Five changes:
1. Added `featAbilityChoice` state (`AbilityKey | null`).
2. `stepComplete("asi")` now requires `featAbilityChoice` to be set when the chosen feat has `chooseAbility: true` with more than one `abilityBonuses` entry.
3. When a feat card is clicked, `featAbilityChoice` resets to `null`.
4. A segmented ability selector appears below the feat grid when a `chooseAbility` feat is picked. Options are rendered as compact `cs-lvl-subcard` buttons labeled "+1 to…".
5. `finish()` stores `abilityChoice` on the feat `ASIChoice` when confirmed.
6. The summary step displays `(+1 STR)` or similar next to the feat name.

**`src/lib/validateCharacter.ts`** — Added validation for `asiChoices` array: checks type ("asi" or "feat"), level range, `featId` length for feat entries, and validates `abilityChoice` is a valid `AbilityKey` if present.

**`src/app/globals.css`** — Added `.cs-feat-ability-choice` and `.cs-feat-ability-options` styling for the selector.

### Verification

- Leveled a character to an ASI level, chose Athlete → modal showed "+1 to…" with STR / DEX buttons.
- Choosing DEX applied +1 DEX (confirmed on sheet's DEX score/mod, initiative, DEX saves).
- Choosing STR applied +1 STR (confirmed).
- A fixed half-feat (all listed abilities, `fixedAbility: true`) showed no selector and applied without prompt.
- An existing character with a previously-taken Athlete (no `abilityChoice` field) loaded and still showed +1 to the first ability (backward-compatible default).
- `npm run lint` and `npm run build` clean.
