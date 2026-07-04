# Feat Verification Guide

Use this guide to verify that every feat in `src/data/feats.json` is either fully automated, prompts for the required choices, or is clearly represented as a manual/trackable feature on the character sheet.

Current catalog size: 83 feats.

## Verification Goal

A feat passes only if selecting it at level-up does all of the following:

1. Enforces or clearly warns about prerequisites.
2. Prompts for every required choice.
3. Applies any ability score increase.
4. Adds any granted spells, proficiencies, languages, tools, resources, or passive bonuses.
5. Shows the source of the change somewhere visible on the sheet.
6. Provides a tracker for limited-use benefits, or clearly marks the benefit as manual if the app cannot automate it yet.
7. Survives refresh, logout/login, and character reload.
8. Resets long-rest resources when the Long Rest button is used.

If a feat has a rules effect that the app does not currently automate, it should not silently disappear. It should create a visible note, custom effect, spell status, proficiency tag, or resource tracker.

## Tester Setup

Create a throwaway character for each class/race group being tested. Testing on a copy avoids corrupting real characters.

Recommended baseline characters:

1. Human Fighter level 3, then level to 4 for a broad no-prerequisite ASI test.
2. Wizard level 3, then level to 4 for spell-grant and spellcasting interactions.
3. Elf, Dwarf, Halfling, Dragonborn, Tiefling, Gnome, and Half-Orc test characters for racial prerequisite feats.
4. A character with Spellcasting or Pact Magic for spellcaster-prerequisite feats.
5. A character without Spellcasting or Pact Magic for negative prerequisite tests.

For each test, record:

- Character name and class/race.
- Starting ability scores and derived stats before leveling.
- Feat selected.
- Choices offered by the UI.
- Expected result.
- Actual result.
- Pass, partial, or fail.

## General Level-Up Flow

1. Open a test character at the level immediately before an ASI level, usually level 3.
2. Click the level-up button.
3. Complete HP and subclass steps if they appear.
4. On the Feat step, select the feat being tested.
5. Verify that any required choice UI appears before confirmation.
6. Confirm level-up.
7. Check the character sheet sections that should change:
   - Abilities
   - Saves
   - Skills
   - Proficiencies & Training
   - Equipment
   - Attacks
   - Spells
   - Effects & Conditions
   - Features & Traits
8. Refresh the page and verify the same results persist.
9. Log out and back in, then verify again.

## Feat Categories To Test

### 1. Fixed Ability Increase Feats

These should apply a specific +1 ability score without requiring an ability choice.

Examples:

- Actor: +1 CHA
- Durable: +1 CON
- Dwarf Fortitude: +1 CON
- Gunner: +1 DEX
- Heavily Armored: +1 STR
- Heavy Armor Master: +1 STR
- Infernal Constitution: +1 CON
- Keen Mind: +1 INT
- Linguist: +1 INT

Expected result:

- Ability score increases by 1.
- Any affected modifier, save, skill, attack, spell DC, spell attack, initiative, or AC updates immediately.
- The source should be inspectable or visible enough that a player understands it came from the feat.

### 2. Choice Ability Increase Feats

These must prompt the player to choose one listed ability. The Confirm button should not allow completion until the choice is made.

Examples:

- Athlete
- Chef
- Crusher
- Dragon Fear
- Dragon Hide
- Elven Accuracy
- Fey Touched
- Gift of the Gem Dragon
- Observant
- Resilient
- Shadow Touched
- Skill Expert
- Telekinetic
- Telepathic
- Weapon Master

Expected result:

- Only the feat's legal ability choices are shown.
- The selected ability increases by 1.
- No default ability is silently chosen if the player does not pick one.
- The selected ability persists after refresh.

### 3. Numeric Passive Bonuses

These should change the relevant derived stat automatically when possible.

Priority examples:

- Alert: initiative increases by +5.
- Dual Wielder: AC increases by +1 only when the character is actually dual-wielding melee weapons, if equipment-state automation exists. If not automated yet, it must be represented as a manual effect or clear note.
- Dragon Hide: unarmored AC option becomes 13 + DEX, if automated. If not automated, it must be represented as a manual effect or clear note.
- Tough: max HP increases by 2 per character level and continues adding +2 on later level-ups.

Expected result:

- Always-on numeric bonuses update the displayed value.
- Conditional bonuses either update only when their condition is true or are clearly trackable through Effects & Conditions.
- The AC breakdown, HP display, or initiative display should show where the number came from.

### 4. Spell-Granting Feats

These are the most important group to verify because they often require extra choice UI and limited-use tracking.

Spell-granting feats include at least:

- Artificer Initiate
- Drow High Magic
- Fey Teleportation
- Fey Touched
- Gift of the Metallic Dragon
- Magic Initiate
- Ritual Caster
- Rune Shaper
- Shadow Touched
- Spell Sniper
- Wood Elf Magic

Expected result for any granted spell:

- The feat prompts for required spell choices.
- Granted spells appear in the character's spell list or spellbook.
- Granted spells are labeled with their source, for example `Fey Touched feat`.
- Once-per-rest spell uses have a tracker.
- "Cast free" does not spend a spell slot.
- Casting with a normal slot remains possible when the feat allows it.
- Long Rest resets the free-use tracker.

#### Fey Touched Acceptance Test

Fey Touched should do all of this:

1. At the Feat step, select Fey Touched.
2. Choose INT, WIS, or CHA for the +1 ASI.
3. Choose one 1st-level Divination or Enchantment spell.
4. Confirm level-up.
5. Verify the chosen ability increased by 1.
6. Verify Misty Step appears in the spell list.
7. Verify the chosen 1st-level Divination/Enchantment spell appears in the spell list.
8. Verify both spells are labeled `Fey Touched feat` or equivalent.
9. Verify both spells have a free-use tracker.
10. Click Cast free for one granted spell.
11. Verify no spell slot is spent.
12. Verify the spell shows Free use spent.
13. Take a Long Rest.
14. Verify the spell shows Free use ready again.

Known current issue to check: Fey Touched appears to award the ASI but does not award the level 1 spell. This should be logged as a fail until the feat-spell grant flow is implemented.

#### Shadow Touched Acceptance Test

Shadow Touched should mirror the Fey Touched pattern:

1. Choose INT, WIS, or CHA for the +1 ASI.
2. Automatically learn Invisibility.
3. Choose one 1st-level Illusion or Necromancy spell.
4. Label both granted spells with `Shadow Touched feat`.
5. Track the free cast and reset it on Long Rest.

### 5. Proficiency, Language, Tool, and Save Feats

These feats should add selectable proficiencies or require a manual choice:

- Chef: cook's utensils
- Gunner: firearms
- Heavily Armored: heavy armor
- Lightly Armored: light armor
- Moderately Armored: medium armor and shields
- Poisoner: poisoner's kit
- Prodigy: skill, tool/language, expertise
- Resilient: saving throw proficiency for the chosen ability
- Skill Expert: one skill proficiency and one expertise
- Skilled: three skills or tools
- Weapon Master: four weapon proficiencies
- Linguist: three languages
- Fey Teleportation: Sylvan

Expected result:

- The UI prompts for every required selection.
- New proficiencies appear under Proficiencies & Training or the relevant sheet area.
- Armor and shield proficiency changes affect equipment warnings.
- Saving throw proficiency changes affect the correct save bonus.
- Skill proficiency changes affect the correct skill bonus.
- Expertise, if supported, doubles proficiency. If expertise is not supported yet, the feat should create a visible manual note.

### 6. Limited-Use Resource Feats

These need a tracker or a visible manual reminder.

Examples:

- Lucky: 3 per long rest
- Gift of the Gem Dragon: PB per long rest
- Gift of the Metallic Dragon: Cure Wounds 1 per long rest and Protective Wings PB per long rest
- Guile of the Cloud Giant: PB per long rest
- Strike of the Giants and follow-up giant feats: PB per long rest or feat-specific limits
- Fey Teleportation: Misty Step 1 per short rest
- Drow High Magic: Levitate and Dispel Magic 1 per long rest
- Wood Elf Magic: Longstrider and Pass without Trace 1 per long rest

Expected result:

- Tracker maximum is correct: fixed count, PB/day, short rest, or long rest.
- Using the feature decrements or marks it spent.
- Short Rest resets short-rest resources.
- Long Rest resets long-rest resources.
- The tracker persists after refresh.

### 7. Attack and Damage Modifier Feats

These affect attacks conditionally and should be tested from the Attacks section.

Examples:

- Great Weapon Master: optional -5 to hit / +10 damage on heavy weapon attacks.
- Sharpshooter: optional -5 to hit / +10 damage on ranged weapon attacks.
- Polearm Master: bonus attack and opportunity attack reminder.
- Crossbow Expert: loading and close-range attack rules.
- Crusher, Piercer, Slasher: weapon damage type riders.
- Savage Attacker: damage reroll reminder.
- Tavern Brawler: unarmed strike and improvised weapon behavior.

Expected result:

- If automated, attack rows should expose the relevant toggle or extra action.
- If not automated, the feat should create a visible effect or feature reminder.
- Damage dice and bonuses should remain correct after equipping or unequipping weapons.

### 8. Prerequisite Tests

Prerequisites should be tested in both directions:

1. Create a character that qualifies.
2. Confirm the feat appears and can be selected.
3. Create a character that does not qualify.
4. Confirm the feat is hidden, disabled, or clearly marked unavailable.

Prerequisite types:

- Racial prerequisites, such as Bountiful Luck, Drow High Magic, Dwarf Fortitude, Fade Away, Fey Teleportation, Infernal Constitution, Orcish Fury, Prodigy, Second Chance, Squat Nimbleness, Wood Elf Magic.
- Spellcasting or Pact Magic prerequisites, such as Eldritch Adept, Elemental Adept, Metamagic Adept, Spell Sniper, War Caster.
- Level prerequisites and chained feat prerequisites, such as the Giant feat chain.

Known current risk to check: the level-up feat list should be audited carefully because prerequisite filtering may not currently use the character's race, level, spellcasting status, or existing feat list.

## Full Regression Matrix Template

Use one row per feat and duplicate rows when a feat has multiple choice branches.

| Feat | Character setup | Choices required | Expected result | Actual result | Pass/Partial/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Fey Touched | Level 3 Wizard to 4 | ASI ability, 1 spell | +1 ability, Misty Step, chosen spell, free-use trackers |  |  | Known suspected fail |
| Shadow Touched | Level 3 Wizard to 4 | ASI ability, 1 spell | +1 ability, Invisibility, chosen spell, free-use trackers |  |  |  |
| Alert | Any level 3 to 4 | None | Initiative +5 |  |  |  |
| Resilient | Any level 3 to 4 | Ability | +1 ability, save proficiency |  |  |  |
| Tough | Any level 3 to 4 | None | Max HP +2 per level |  |  |  |

## Suggested Pass Order

1. Smoke test 10 representative feats:
   - Alert
   - Actor
   - Athlete
   - Fey Touched
   - Shadow Touched
   - Resilient
   - Skill Expert
   - Heavily Armored
   - Tough
   - Lucky
2. Fix any systemic issues found in the smoke test.
3. Run the full 83-feat matrix.
4. Retest all spell-granting feats.
5. Retest prerequisites.
6. Retest long rest and short rest resets.

## Definition Of Done

The feat system is complete when:

- Every feat can be selected only when legal, or the UI clearly marks it unavailable.
- Every feat with a choice prompts for that choice.
- Every feat effect is automated where reasonable.
- Every non-automated effect is visible and trackable.
- Fey Touched and Shadow Touched grant their fixed spell plus chosen spell.
- Spell-granting feats add source labels and free-use trackers.
- Limited-use feat resources reset on the correct rest.
- The result persists across refresh and login.
- `npm run lint` and `npm run build` pass.
