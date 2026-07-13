# Action Capability Audit — README

**Date:** 2026-07-12  
**Ruleset:** 2014 5e SRD + Tasha's Cauldron of Everything (Artificer)  
**Scope:** Evidence gathering, classification, and catalog preparation for all action capabilities across the Forge & Fable ruleset.

## Overview

This audit inventories every capability relevant to activation, triggering, resource use, combat resolution, or passive modification across 13 classes (~110 subclasses), ~100 feats, and 521 spells. It does **not** change runtime behavior, define a production schema, or modify any `src/` files.

## Files

| File | Contents | Records |
|---|---|---|
| `universal-2014.json` | Universal combat actions (Attack, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object, Grapple, Shove, Opportunity Attack, Two-Weapon Fighting, Improvised Action, Cast a Spell) | 15 |
| `class-barbarian.json` | Barbarian + 8 subclasses (Berserker, Totem Warrior, Ancestral Guardian, Storm Herald, Zealot, Beast, Wild Soul, Battlerager) | 35 |
| `class-bard.json` | Bard + 8 subclasses (Lore, Valor, Creation, Glamour, Swords, Whispers, Eloquence, Spirits) | 23 |
| `class-cleric.json` | Cleric + 14 subclasses (Knowledge, Life, Light, Nature, Tempest, Trickery, War, Death, Twilight, Order, Forge, Grave, Peace, Arcane) | 22 |
| `class-druid.json` | Druid + 7 subclasses (Land, Moon, Dreams, Shepherd, Spores, Stars, Wildfire) | 21 |
| `class-fighter.json` | Fighter + 10 subclasses (Champion, Battle Master, Eldritch Knight, Arcane Archer, Cavalier, Samurai, Psi Warrior, Rune Knight, Echo Fighter, Purple Dragon Knight) | 35 |
| `class-monk.json` | Monk + 10 subclasses (Open Hand, Shadow, Four Elements, Mercy, Astral Self, Drunken Master, Kensei, Sun Soul, Long Death, Ascendant Dragon) | 29 |
| `class-paladin.json` | Paladin + 9 subclasses (Devotion, Ancients, Vengeance, Oathbreaker, Conquest, Redemption, Glory, Watchers, Crown) | 57 |
| `class-ranger.json` | Ranger + 8 subclasses (Hunter, Beast Master, Gloom Stalker, Horizon Walker, Monster Slayer, Fey Wanderer, Swarmkeeper, Drakewarden) | 28 |
| `class-rogue.json` | Rogue + 9 subclasses (Thief, Assassin, Arcane Trickster, Inquisitive, Mastermind, Scout, Swashbuckler, Phantom, Soulknife) | 42 |
| `class-sorcerer.json` | Sorcerer + 7 subclasses (Draconic, Wild Magic, Divine Soul, Storm, Shadow, Aberrant Mind, Clockwork Soul) | 17 |
| `class-warlock.json` | Warlock + 9 subclasses (Archfey, Fiend, Great Old One, Celestial, Undying, Hexblade, Fathomless, Genie, Undead) | 17 |
| `class-wizard.json` | Wizard + 13 subclasses (Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation, Graviturgy, Chronurgy, War Magic, Bladesinging, Scribes) | 20 |
| `class-artificer.json` | Artificer + 4 subclasses (Armorer, Alchemist, Artillerist, Battle Smith) | 17 |
| `feats.json` | Feats granting or modifying actions, bonus actions, reactions, or combat capabilities | 34 |
| `spells.json` | Mechanical classification of 521 spells by casting time, concentration, ritual status, and resolution type | 521 |
| `unresolved.json` | Flagged items requiring review: mixed-edition content, data bugs, insufficient evidence | 12 |
| `coverage.md` | Detailed coverage counts and breakdowns | — |

## Classification Summary

| Classification | Count | Description |
|---|---|---|
| `action` | 477 | Standard actions (Attack, Cast a Spell, Dash, etc.) |
| `bonus-action` | 105 | Two-Weapon Fighting, Cunning Action, etc. |
| `passive` | 98 | Always-on modifiers (Unarmored Defense, Auras, etc.) |
| `long-activation` | 95 | 1-minute+ activities (rituals, crafting, recovery) |
| `reaction` | 65 | Opportunity Attacks, Uncanny Dodge, Shield spell, etc. |
| `rider` | 39 | Abilities that add to existing actions (Divine Smite, Sneak Attack) |
| `triggered` | 31 | Features that activate on a condition (Relentless Endurance, etc.) |
| `special` | 17 | Unique activation patterns (Action Surge, Metamagic, etc.) |
| `needs-review` | 12 | Entries needing human adjudication |
| `replacement` | 6 | Features that replace how an existing action works |

## Shared Resource Candidates

Resources used across multiple features within a class:
- `channel-divinity-uses` — Paladin, Cleric (multiple oath/domain options)
- `bardic-inspiration-dice` — Bard (and multiple subclass BI variants)
- `sorcery-points` — Sorcerer (Font of Magic, Metamagic, subclass features)
- `ki-points` — Monk (Flurry of Blows, Stunning Strike, subclass features)
- `rage-uses` — Barbarian (base Rage, Frenzy, Storm Aura, etc.)
- `wild-shape-uses` — Druid (base Wild Shape, Combat Wild Shape, Starry Form, etc.)
- `spell-slots` — All casters (shared across spells and smiting)
- `psionic-energy-dice` — Fighter (Psi Warrior) and Rogue (Soulknife)

## Features Needing Target Selection or DM Adjudication

- All spells with area effects (save-based targeting)
- Grapple and Shove (contested checks)
- Hide (DM decides if conditions are met)
- Improvised Action (fully DM-adjudicated)
- Divine Intervention (DM adjudicates deity response)
- Wild Magic Surge / Tales from Beyond (random tables)

## Features That Appear Safe for Automatic Execution

- Cantrips and straightforward damaging spells with defined dice
- Second Wind (self-heal with fixed formula)
- Cunning Action (Dash/Disengage/Hide as bonus action)
- Uncanny Dodge (half damage on reaction)
- Action Surge (grant additional action)
- Deflect Missiles (damage reduction + optional counterattack)

## Features That Should Remain Reference Cards

- Divine Intervention (DM adjudication)
- Wild Shape (requires beast stat blocks and DM rulings on known forms)
- Spellcasting with full description text
- Features with complex area effects or condition tracking
- Features modifying other features (Improved Critical, etc.)

## Unresolved Items

See `unresolved.json` for 12 flagged entries covering:
- Mixed-edition content (Monk Ki/focus points terminology)
- Mutually exclusive rules variants (Beast Master companion options)
- Data bugs (missing subclassLevel, wrong expertise counts)
- Missing feature descriptions (Archdruid — appears resolved)
- Empty/skeletal subclasses (Arcane Domain — appears populated)

## Validation Status

All JSON files parse successfully. All `auditId` values are unique across the audit folder. Every record has at least one evidence entry. All classifications and resolution kinds use only the allowed values. No `src/` files were modified during this audit.
