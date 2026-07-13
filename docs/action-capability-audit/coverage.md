# Coverage Report — Action Capability Audit

**Date:** 2026-07-12  
**Total Records:** 945

## Totals by Source Kind

| Source Kind | Count |
|---|---|
| spell | 521 |
| subclass | 265 |
| class | 109 |
| feat | 34 |
| universal | 16 |

## Totals by Classification

| Classification | Count |
|---|---|
| action | 477 |
| bonus-action | 105 |
| passive | 98 |
| long-activation | 95 |
| reaction | 65 |
| rider | 39 |
| triggered | 31 |
| special | 17 |
| needs-review | 12 |
| replacement | 6 |

## Totals by Resolution Kind

| Resolution Kind | Count |
|---|---|
| mixed | 425 |
| reference-only | 189 |
| attack | 106 |
| damage | 52 |
| saving-throw | 45 |
| ability-check | 33 |
| movement | 28 |
| healing | 21 |
| state-toggle | 15 |
| needs-review | 12 |
| resource-conversion | 10 |
| choice | 7 |
| healing-or-condition-removal | 2 |

## Per-File Counts

| File | Records | Classes/Subclasses Covered |
|---|---|---|
| `universal-2014.json` | 15 | N/A (universal rules) |
| `class-paladin.json` | 57 | Paladin (9 subclasses) |
| `class-rogue.json` | 42 | Rogue (9 subclasses) |
| `class-barbarian.json` | 35 | Barbarian (8 subclasses) |
| `class-fighter.json` | 35 | Fighter (10 subclasses — Purple Dragon Knight not fully covered) |
| `class-monk.json` | 29 | Monk (10 subclasses) |
| `class-ranger.json` | 28 | Ranger (8 subclasses) |
| `class-bard.json` | 23 | Bard (8 subclasses) |
| `class-cleric.json` | 22 | Cleric (14 subclasses) |
| `class-druid.json` | 21 | Druid (7 subclasses) |
| `class-wizard.json` | 20 | Wizard (13 subclasses) |
| `class-artificer.json` | 17 | Artificer (4 subclasses) |
| `class-sorcerer.json` | 17 | Sorcerer (7 subclasses) |
| `class-warlock.json` | 17 | Warlock (9 subclasses) |
| `feats.json` | 34 | ~100 feats (subset with combat-relevant capabilities) |
| `spells.json` | 521 | All 521 spells in catalog |
| `unresolved.json` | 12 | 12 unresolved items |

## Unresolved and Mixed-Edition Counts

- **needs-review records:** 12 (in `unresolved.json`)
- **Low/medium confidence records:** 5 (primarily for items where prior audits showed bugs that appear resolved — needs verification)
- **Mixed-edition flags:** 1 (Monk ki/focus-points terminology)

## Shared-Resource Candidates

Resources consumed by multiple features within the same class:
- `channel-divinity-uses` — Paladin (9 oaths × 2-3 CD options each), Cleric (14 domains × 2-3 CD options each)
- `bardic-inspiration-dice` — Bard (multiple subclass features consume or modify BI dice)
- `sorcery-points` — Sorcerer (Font of Magic conversion, Metamagic, subclass features)
- `ki-points` — Monk (Flurry of Blows, Patient Defense, Step of the Wind, Stunning Strike, subclass features)
- `rage-uses` — Barbarian (Rage activation, Frenzy, Storm Aura, etc.)
- `wild-shape-uses` — Druid (Wild Shape, Combat Wild Shape, Starry Form, Symbiotic Entity, Summon Wildfire Spirit)
- `spell-slots` — All casting classes (shared between spellcasting and smiting)
- `psionic-energy-dice` — Fighter (Psi Warrior) and Rogue (Soulknife)

## Features Whose Activation Changes Due to Another Feature

- **Wild Shape:** action → bonus action (Moon Druid: Combat Wild Shape)
- **Dash/Disengage/Hide:** action → bonus action (Rogue: Cunning Action; Monk: Step of the Wind for Dash/Disengage)
- **Help:** action → bonus action (Mastermind Rogue: Master of Tactics)
- **Use an Object:** action → bonus action (Thief Rogue: Fast Hands)
- **Hide:** action → bonus action (Ranger L14: Vanish)
- **Shove:** attack-replacement → bonus action (Shield Master feat)
- **Grapple:** attack-replacement → bonus action (Tavern Brawler feat)
- **Poison application:** action → bonus action (Poisoner feat)
- **Opportunity Attack:** weapon attack → spell cast (War Caster feat)
- **Casting time:** action → bonus action (Sorcerer: Quickened Spell Metamagic)

## Features Needing Target Selection or DM Adjudication

- Area-effect spells and abilities (targeting decisions)
- Grapple and Shove (contested ability checks)
- Hide action (DM determines if conditions are met)
- Improvised actions (fully DM-adjudicated)
- Divine Intervention (DM arbitrates deity response)
- Random-table features (Wild Magic Surge, Tales from Beyond, Experimental Elixir)
- Features requiring the DM to describe the environment (favored terrain, hiding spots)

## Features That Appear Safe for Automatic Execution

- Self-targeting heals with fixed or simple dice formulas (Second Wind, Lay on Hands)
- Action economy modifiers (Action Surge, Cunning Action)
- Passive numerical modifiers (Fighting Styles, Auras, Unarmored Defense)
- Damage riders with clear triggers and fixed formulas (Divine Smite, Sneak Attack, Improved Divine Smite)
- Straightforward reaction defenses (Uncanny Dodge, Deflect Missiles damage reduction)
- Simple state toggles with clear resource costs (Rage, Bladesong)

## Features That Should Remain Reference Cards

- Divine Intervention (requires DM adjudication)
- Wild Shape (requires beast stat blocks, DM knowledge of what forms you've seen)
- Conjure/summon spells (require creature stat blocks)
- Complex illusion spells (DM-dependent)
- Wish and similarly open-ended spells
- Features with extensive condition trees or branching outcomes

## Quality Checks Passed

- ✅ All 17 JSON files parse successfully
- ✅ No duplicate `auditId` values (945 unique IDs)
- ✅ Every record has at least one evidence entry
- ✅ All classifications use only allowed enum values
- ✅ All resolution kinds use only allowed enum values
- ✅ No `src/` files were modified during this audit
- ✅ All `needs-review` and low-confidence entries are reported
