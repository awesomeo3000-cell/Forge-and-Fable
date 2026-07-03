# Forge & Fable — Round 9: Tier 1 rules polish (three small features)

**Audience:** DeepSeek (or comparable) in a fresh session.
**Repo root:** `E:\forge-and-fable`
**Theme:** three small, high-value 5e correctness features that are independent of each
other. Do them in order; each has its own verification and its own changelog section. If
you only finish some, that's fine — a feature with no changelog entry counts as not done.

## 0. Shared context (read first)

Next.js 16 / React 19 / TypeScript. Rules data lives in `src/lib/ruleset.ts` and
`src/lib/srd.ts`; character shape in `src/types/game.ts`; the live sheet is
`src/components/HeroSheet.tsx`; the builder is `src/components/CreatorPanel.tsx`; level-up
is `src/components/LevelUpModal.tsx`. Persisted updates go through `onUpdate(patch)` (PUT;
**`JSON.stringify` drops `undefined` — send `null` or omit**) and the server allowlist +
validation is `src/lib/validateCharacter.ts` (copy the `effects` case as the model). Any
new persisted field must be added to the allowlist AND validated. CSS is append-only at the
end of `src/app/globals.css`; use theme tokens (`--parchment`, `--ink-faint`, `--rule-soft`,
`--accent`) so dark skins (Necromancer) stay readable. Verify in the running app on the
launch config `forge-and-fable` (port 3005); `npm run build` + `eslint` must stay clean.

Roll pipeline note (feature 2): d20 rolls flow through `pushRoll`/`pushD20` in
`ForgeAndFableApp.tsx`; `pushD20` already exists (advantage/disadvantage) and records a
`RollHistoryEntry` with an optional `adv` field. History renders in
`src/components/RollDrawer.tsx`; the 3D dice + crit banner are in
`src/components/DiceRollOverlay.tsx`.

---

## Feature 1 — Backgrounds that grant skills

**Gap:** `ruleset.backgrounds` (`ruleset.ts:641`) is a flat `string[]` ("Acolyte",
"Criminal", "Sage", "Soldier", "Custom Background"); `Character.background` is a plain
string and grants **nothing**. Class skills come from `CLASS_SKILL_CHOICES` in `srd.ts`
and land in `Character.skillProficiencies` (a string[] of skill ids from `SKILLS` in
`srd.ts`). Backgrounds should grant their standard skills automatically and **stack** with
the class-skill picker (union, no duplicates).

**Data:** add a table in `srd.ts` (next to `CLASS_SKILL_CHOICES`):

```ts
export const BACKGROUND_SKILLS: Record<string, string[]> = {
  Acolyte:  ["insight", "religion"],
  Criminal: ["deception", "stealth"],
  Sage:     ["arcana", "history"],
  Soldier:  ["athletics", "intimidation"],
  // "Custom Background" grants none.
};
```

(Skill ids must match `SKILLS[].id`. These are the SRD pairings — keep them.)

**Application — the important design decision:** background skills are *derived*, not a
silent write into `skillProficiencies`. Do **not** mutate `skillProficiencies` when a
background is chosen (that would fight the manual skill toggles and double-count on
re-selection). Instead:

- Compute the effective proficient set on the sheet as `union(skillProficiencies,
  BACKGROUND_SKILLS[character.background] ?? [])`. `HeroSheet.tsx` has
  `isSkillProficient(id)` and `skillBonus(s)` — route both through the union so background
  skills show as proficient and add proficiency bonus.
- In the skills UI, mark a background-granted skill as proficient AND visually tag it
  (small "BG" chip or a `title`), and make its manual toggle a no-op / disabled for the
  granted ones (you can't un-choose a background skill without changing background). A
  manual pick that *also* appears in the background is just proficient once.
- Passive Perception/Insight/Investigation already derive from `skillBonus` — they update
  for free once the union is in place.

**Builder (Origin step, `CreatorPanel.tsx`):** when a background is selected, show its
granted skills as read-only chips ("Grants: Insight, Religion") so the player sees the
effect before finalizing. No new draft field needed — it's derived from `background`.

**No persistence change** (background is already stored; skills stay as the manual set).
So no `validateCharacter` change for this feature. Say so in the changelog.

**Verify:** Acolyte character shows Insight + Religion proficient (dot + proficiency bonus
in the total) without clicking them; passive Insight rises by the proficiency bonus; also
manually picking Insight from the class picker doesn't double-add; switching to Custom
Background removes the auto-grants; a skill manually picked that isn't in the background
still persists. Screenshot the skills block for an Acolyte.

---

## Feature 2 — Critical hit / fumble flair (nat 20 / nat 1)

**Gap & what already exists:** `DiceRollOverlay.tsx` already detects a **nat 20** on a d20
and fires the `ClarebearCrit` "crit banner" + an `is-crit` face highlight (see the `crits`
filter and `D20Object`'s `isCrit`). Two gaps: (a) **nat 1 (fumble)** has no treatment at
all, and (b) the **roll history / drawer** shows no crit-or-fumble marker — you only catch
it if you're watching the animation. This feature adds nat-1 flair and a persistent
history marker for both, without a second confetti system.

**Detection:** the natural d20 face is the raw die result *before* modifiers. For normal
rolls that's the single d20; for advantage/disadvantage it's the **kept** die (a dropped 20
is not a crit — `pushD20` already flags dropped dice and the crit banner already excludes
them; keep that). Do the detection where the outcome is assembled:

- `pushD20` (adv/dis + normal d20 checks) — you have the kept d20 face directly.
- `pushRoll` when `sides === 20 && count === 1` (covers any legacy single-d20 path).
- Do **not** flag crits on damage dice, hit dice, or multi-die pools.

**History marker:** extend `RollHistoryEntry` (in `RollDrawer.tsx`) with an optional
`nat?: "crit" | "fumble"`, set it from the kept/only natural d20 (20 → crit, 1 → fumble),
thread it through `recordHistory` (like the existing `adv` field), and render a small
gold "NAT 20" / muted-red "NAT 1" chip on the history row. Reuse the `roll-history-badge`
styling pattern already in `globals.css`.

**Overlay:** add a **fumble** counterpart to the existing nat-20 path — a restrained
nat-1 treatment (e.g. a desaturated/cracked `is-fumble` face state and a brief muted
"FUMBLE" banner mirroring `ClarebearCrit`'s timing). Keep it tasteful and **theme-token
based**; the nat-20 banner text is deliberately over-the-top already, so match tone but
don't add new hard-coded bright colors that break dark skins.

**Landmines:** don't double-fire the banner for adv rolls (filter dropped dice — already
done); a nat-1 on a *dropped* die during advantage is **not** a fumble; keep the crit/fumble
purely cosmetic — it must not change totals or auto-apply damage.

**Verify:** roll d20s until you see a nat 20 and a nat 1 (or temporarily force
`rollDie`): confirm the banner + face state for each, the history chip for each, and that
an advantage roll of `[1, 20] keep 20` shows crit (not fumble) while `[1, 20] keep 1`
(disadvantage) shows fumble — and neither fires the *other's* banner. Confirm damage rolls
never show a crit chip. Screenshot a crit and a fumble history row.

---

## Feature 3 — Half-feat ability choice (STR **or** DEX, etc.)

**Gap:** half-feats carry `chooseAbility: true` with `abilityBonuses: ["strength",
"dexterity"]` (see `feats.json` → Athlete). But `computeFeatBonuses` in
`src/lib/featBonuses.ts` silently applies the bonus to `feat.abilityBonuses[0]` — its own
comment says *"the UI would ideally let the player pick; for now default to first"*. And
`ASIChoice`'s feat variant (`game.ts:89`) is `{ type: "feat"; level: number; featId:
string }` with **nowhere to store the chosen ability**. So taking Athlete always silently
gives +1 STR.

**Data model:** extend the feat `ASIChoice` variant with an optional chosen ability:

```ts
| { type: "feat"; level: number; featId: string; abilityChoice?: AbilityKey };
```

Optional so existing saved characters stay valid. Allowlist/validate it in
`validateCharacter.ts` if `asiChoices` is validated there (check; if `asiChoices` is
already allowlisted, extend its per-entry check to accept an optional `abilityChoice` that
is a valid `AbilityKey` **and** is one of the feat's `abilityBonuses`).

**Application:** in `computeFeatBonuses`, the `chooseAbility` branch becomes
`const key = choice.abilityChoice ?? feat.abilityBonuses[0];` — honor the choice, keep the
first-listed as the backward-compatible default. Update the `sources` label to the chosen
ability. (Fixed feats — `fixedAbility: true` — are unchanged.)

**UI (`LevelUpModal.tsx`):** when the player picks a feat whose `chooseAbility` is true,
show a small inline ability selector (radio/segmented over `feat.abilityBonuses`, labeled
"+1 to…"), required before the level-up can be confirmed. Store the pick as
`abilityChoice` on the feat `ASIChoice`. Feats with a single-element `abilityBonuses` or
`fixedAbility` show no selector. Mirror the modal's existing choice styling.

**Verify:** level a character to an ASI level, choose Athlete → the modal requires a STR/DEX
pick; choosing DEX applies +1 DEX (confirm on the sheet's DEX score/mod, initiative, DEX
saves), choosing STR applies +1 STR; a fixed half-feat (all listed abilities, `fixedAbility`)
still applies without a prompt; an existing character with a previously-taken Athlete (no
`abilityChoice`) still loads and still shows +1 to the first ability (no crash, no
double-apply). Screenshot the modal's ability selector.

---

## Deliverable

Code + `docs/CHANGES-9.md` with one section per feature: what changed per area, what you
clicked, what you observed, and any deviation (e.g. if you left background skills as a
derived union vs. a written field, say so and why). Keep `npm run build` and `eslint`
clean. No changelog section for a feature = that feature is not done.
