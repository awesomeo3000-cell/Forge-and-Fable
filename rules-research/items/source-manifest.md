# D&D 5e Source Manifest for Item Research

**Manifest version:** 1.0.0  
**Status:** Frozen  
**Schema version:** 1.0.0  
**Research cutoff:** 2026-07-16  
**Last refreshed:** 2026-07-17  
**Total sources cataloged:** 74  
**Sources included:** 53  
**Sources excluded:** 16  
**Sources pending review:** 5  

---

## Purpose

This manifest catalogs every official Dungeons & Dragons Fifth Edition product that could contain player-usable items. It is the canonical reference for determining which sources need item-by-item research before the catalog can claim exhaustiveness.

Each source is classified by:
- **Publisher Lane:** wizards-first-party, official-licensed, partnered, charity, third-party
- **Rules Family:** 2014 or 2024
- **Source Type:** core-book, supplement, setting, adventure, anthology, starter, digital, promotional
- **Inclusion Status:** included, excluded, or pending-review
- **Research Status:** not-started, in-progress, complete, blocked

### Scope Rule

A feature, gift, charm, blessing, or boon is excluded from the item catalog unless the source explicitly defines it as a possessable inventory item. Non-item character options (supernatural gifts, dark gifts, piety gifts, charms, blessings) are out of scope.
- **Inclusion Status:** included, excluded, or pending-review

---

## Summary Statistics

| Category | Total | Included | Excluded | Pending |
|---|---|---|---|---|
| Core Books | 8 | 6 | 2 | 0 |
| Supplements | 9 | 6 | 3 | 0 |
| Setting Books | 11 | 10 | 0 | 1 |
| Adventures | 18 | 18 | 0 | 0 |
| Anthologies | 8 | 7 | 1 | 0 |
| Starter Sets | 5 | 4 | 0 | 1 |
| Digital/Promotional | 10 | 2 | 7 | 1 |
| **TOTAL** | **65** | **48** | **14** | **3** |

Note: Tyranny of Dragons (2023 combined) and Wayfinder's Guide to Eberron are counted as excluded (superseded/reprints). The 2014 and 2025 Monster Manuals are excluded as they contain no standalone item definitions.

---

## 2014 Rules Family Core Books

| Source Code | Title | Date | Contains Items? | Status |
|---|---|---|---|---|
| `phb-2014` | Player's Handbook (2014) | 2014-08-19 | Yes — weapons, armor, adventuring gear, tools, mounts, trade goods | Included |
| `dmg-2014` | Dungeon Master's Guide (2014) | 2014-12-09 | Yes — ~300+ magic items, artifacts, sentient items, poisons, treasure tables | Included |
| `mm-2014` | Monster Manual (2014) | 2014-09-30 | No — monster stat blocks only | Excluded |
| `srd-5.1` | System Reference Document 5.1 | 2016-01-12 | Yes — representative subset of PHB + DMG items (OGL) | Included |

## 2024 Rules Family Core Books

| Source Code | Title | Date | Contains Items? | Status |
|---|---|---|---|---|
| `phb-2024` | Player's Handbook (2024) | 2024-09-17 | Yes — weapons (with masteries), armor, gear, firearms, crafting rules | Included |
| `dmg-2024` | Dungeon Master's Guide (2024) | 2024-11-12 | Yes — revised magic item catalog, artifacts, sentient items, poisons | Included |
| `mm-2025` | Monster Manual (2025) | 2025-02-18 | No — monster stat blocks only (Gear entries reference PHB/DMG) | Excluded |
| `srd-5.2` | System Reference Document 5.2 | 2025-04-22 | Yes — 15 magic items, firearms, weapon masteries (CC-BY-4.0) | Included |

---

## Rules Supplements (2014 Era)

| Source Code | Title | Date | Contains Items? | Status |
|---|---|---|---|---|
| `scag` | Sword Coast Adventurer's Guide | 2015-11-03 | Yes — a few setting-specific magic items | Included |
| `vgm` | Volo's Guide to Monsters | 2016-11-15 | No — monsters and races only | Excluded |
| `xgte` | Xanathar's Guide to Everything | 2017-11-21 | Yes — common magic items, reorganized item tables | Included |
| `mtof` | Mordenkainen's Tome of Foes | 2018-05-29 | No — monsters and races only | Excluded |
| `tcoe` | Tasha's Cauldron of Everything | 2020-11-17 | Yes — ~36 magic items, tattoos, foci, artifacts | Included |
| `ftod` | Fizban's Treasury of Dragons | 2021-10-26 | Yes — dragon-themed items, hoard items, dragon vessels | Included |
| `mpmm` | Mordenkainen Presents: Monsters of the Multiverse | 2022-05-17 | No — monster/race compilation only | Excluded |
| `bpgg` | Bigby Presents: Glory of the Giants | 2023-08-15 | Yes — giant-themed relics and artifacts | Included |
| `tbomt` | The Book of Many Things | 2024-01-07 | Yes — 22 deck-inspired magic items | Included |

---

## Setting Books

| Source Code | Title | Date | Rules Family | Contains Items? | Status |
|---|---|---|---|---|---|
| `ggr` | Guildmasters' Guide to Ravnica | 2018-11-20 | 2014 | Yes — Ravnica-specific items | Included |
| `ai` | Acquisitions Incorporated | 2019-06-18 | 2014 | Yes — franchise-themed items | Included |
| `erlw` | Eberron: Rising from the Last War | 2019-11-19 | 2014 | Yes — common items, symbiotic items | Included |
| `egw` | Explorer's Guide to Wildemount | 2020-03-17 | 2014 | Yes — Vestiges of Divergence | Included |
| `mot` | Mythic Odysseys of Theros | 2020-07-21 | 2014 | Yes — god-weapons, artifacts | Included |
| `vrgr` | Van Richten's Guide to Ravenloft | 2021-05-18 | 2014 | Yes — horror items, dark gifts | Included |
| `scc` | Strixhaven: A Curriculum of Chaos | 2021-12-07 | 2014 | Yes — magic items + price table | Included |
| `saag` | Spelljammer: Astral Adventurer's Guide | 2022-08-16 | 2014 | Yes — spelljamming helms, Wildspace items | Included |
| `dsotdq` | Dragonlance: Shadow of the Dragon Queen | 2022-12-06 | 2014 | Yes — dragonlance, setting items | Included |
| `paatm` | Planescape: Adventures in the Multiverse | 2023-10-17 | 2014 | Yes — planar-themed items | Included |
| `efota` | Eberron: Forge of the Artificer | 2025-12-09 | 2024 | Yes — artificer items, airships, bastions | Included |
| `rlthw` | Ravenloft: The Horrors Within | 2026-06-16 | 2024 | Yes — new magic items, dark gifts | Included |

> **Superseded:** `wayfinders-eberron` (Wayfinder's Guide to Eberron, 2018-07-23) was the digital precursor to ERLW. All content was finalized in ERLW. Excluded to prevent duplicates.

---

## Adventure Modules

| Source Code | Title | Date | Levels | Contains Items? | Status |
|---|---|---|---|---|---|
| `hotdq` | Hoard of the Dragon Queen | 2014-08-19 | 1-8 | Yes — adventure treasure | Included |
| `rot` | The Rise of Tiamat | 2014-11-04 | 8-15 | Yes — Dragon Masks, artifacts | Included |
| `potaa` | Princes of the Apocalypse | 2015-04-07 | 1-15 | Yes — elemental items | Included |
| `oota` | Out of the Abyss | 2015-09-15 | 1-15 | Yes — demon/Underdark items | Included |
| `cos` | Curse of Strahd | 2016-03-15 | 1-10 | Yes — Holy Symbol, Sunsword, etc. | Included |
| `skt` | Storm King's Thunder | 2016-09-06 | 1-11 | Yes — giant rune items | Included |
| `toa` | Tomb of Annihilation | 2017-09-19 | 1-9+ | Yes — trickster god items | Included |
| `wdh` | Waterdeep: Dragon Heist | 2018-09-18 | 1-5 | Yes — Vault of Dragons | Included |
| `wdmm` | Waterdeep: Dungeon of the Mad Mage | 2018-11-20 | 5-20 | Yes — megadungeon treasures | Included |
| `bgdia` | Baldur's Gate: Descent into Avernus | 2019-09-17 | 1-13 | Yes — infernal war machines, hellfire weapons | Included |
| `idrotf` | Icewind Dale: Rime of the Frostmaiden | 2020-09-15 | 1-12 | Yes — frost items, chwinga charms | Included |
| `twbtw` | The Wild Beyond the Witchlight | 2021-09-21 | 1-8 | Yes — fey items, charms | Included |
| `crcotn` | Critical Role: Call of the Netherdeep | 2022-03-15 | 3-12 | Yes — ruidium items, Jewel of Three Prayers | Included |
| `patbso` | Phandelver and Below: The Shattered Obelisk | 2023-09-19 | 1-12 | Yes — psionic/obelisk items | Included |
| `veor` | Vecna: Eve of Ruin | 2024-05-21 | 10-20 | Yes — Rod of Seven Parts | Included |

> **Reprint:** `tyranny-of-dragons-combined` (2023) combines HotDQ + RoT with errata. No new items. Excluded.

---

## Anthologies (Multi-Adventure Books)

| Source Code | Title | Date | Adventures | Contains Items? | Status |
|---|---|---|---|---|---|
| `tftyp` | Tales from the Yawning Portal | 2017-04-04 | 7 classic dungeons | Yes — updated classic items | Included |
| `gos` | Ghosts of Saltmarsh | 2019-05-21 | 7 nautical adventures | Yes — ship upgrades, nautical items | Included |
| `cm` | Candlekeep Mysteries | 2021-03-16 | 17 mystery adventures | Yes — book-themed items | Included |
| `jtrc` | Journeys Through the Radiant Citadel | 2022-07-19 | 13 diverse adventures | Yes — cultural items | Included |
| `kftgv` | Keys from the Golden Vault | 2023-02-21 | 13 heist adventures | Yes — heist-themed items | Included |
| `qftis` | Quests from the Infinite Staircase | 2024-07-16 | 6 classic updates | Yes — updated classic items | Included |
| `dd` | Dragon Delves | 2025-07-08 | 10 dragon adventures | **No** — uses core rulebook items only | Excluded |

---

## Starter Sets & Essentials Kits

| Source Code | Title | Date | Rules | Contains Items? | Status |
|---|---|---|---|---|---|
| `lmop` | Lost Mine of Phandelver (Starter Set) | 2014-07-15 | 2014 | Yes — starter magic items | Included |
| `doip` | Dragon of Icespire Peak (Essentials Kit) | 2019-06-24 | 2014 | Yes — quest reward items | Included |
| `dosi` | Dragons of Stormwreck Isle (Starter Set 2022) | 2022-10-04 | 2014 | Yes — beginner items | Included |
| `hofb` | Heroes of the Borderland (Starter Set 2025) | 2025-09-16 | 2024 | Yes — cards include magic items | Included |
| `twbtw-starter` | Stranger Things Starter Set | 2019-05-01 | 2014 | Yes — basic items, possibly duplicates | Pending Review |
| `dndvsram-starter` | D&D vs. Rick and Morty Starter Set | 2019-11-19 | 2014 | Yes — comedy items, may have uniques | Pending Review |

---

## Digital, Promotional, and Extra Life Charity Products

| Source Code | Title | Date | Type | Contains Items? | Status |
|---|---|---|---|---|---|
| `ee-pc` | Elemental Evil Player's Companion | 2015-03-10 | Free PDF | No — spells and races only | Excluded |
| `tortle-package` | The Tortle Package | 2017-09-01 | Extra Life | No — tortle race only | Excluded |
| `one-grung-above` | One Grung Above | 2017-10-01 | Extra Life | No — grung race only (officially UNOFFICIAL) | Excluded |
| `llok` | Lost Laboratory of Kwalish | 2018-11-10 | Extra Life | **Yes — 14 magic items** | Included |
| `imr` | Infernal Machine Rebuild | 2019-11-12 | Extra Life | **Yes — 8 magic items** | Included |
| `locathah-rising` | Locathah Rising | 2019-09-01 | Extra Life | No — locathah race only | Excluded |
| `mffv1` | Mordenkainen's Fiendish Folio, Vol. 1 | 2019-12-03 | Extra Life | No — monsters only | Excluded |
| `muk-adventure` | Adventure with Muk | 2019 | Extra Life | No — children's activity book | Excluded |
| `muks-guide` | Muk's Guide to Everything He Learned From Tasha | 2020-12-01 | Extra Life | No — children's activity book | Excluded |
| `domains-of-delight` | Domains of Delight | 2021-09-21 | Extra Life | Likely — Feywild supplement | Pending Review |
| `minsc-and-boo` | Minsc and Boo's Journal of Villainy | 2021-10-01 | Extra Life | Likely — Baldur's Gate sourcebook (156pp) | Pending Review |
| `misplaced-monsters` | Misplaced Monsters: Volume One | 2023 | Extra Life | No — monsters by children | Excluded |

---

## Superseded, Reprint, and Unofficial Sources

| Source Code | Title | Date | Reason for Exclusion |
|---|---|---|---|
| `wayfinders-eberron` | Wayfinder's Guide to Eberron | 2018-07-23 | Superseded by ERLW (2019). Content finalized in ERLW. |
| `tyranny-of-dragons-combined` | Tyranny of Dragons (2023 Combined) | 2023 | Reprint of HotDQ + RoT with errata. No new items. |

---

## Sources Published After Cutoff (July 2026)

The following sources are scheduled for publication after the July 2026 cutoff and are NOT included in this manifest. They should be added in a future revision:

| Title | Date | Type |
|---|---|---|
| Arcana Unleashed | 2026-09-15 | Supplement (2024 rules) |
| Arcana Unleashed: Deadfall | 2026-09-15 | Adventure (levels 11-20) |
| Season of Champions (TBA) | Q4 2026 | Sourcebook |

---

## Key Observations

1. **Item density varies wildly.** The DMG (2014) has ~300+ items; some adventures have fewer than 10. The 2024 DMG has a revised and reorganized catalog. Both DMG editions are the foundational item sources.

2. **Monster Manuals don't contain items.** Neither the 2014 nor 2025 Monster Manuals define standalone player-usable items. The 2025 MM's "Gear" entries and Treasure Tags are DM guidance that reference PHB/DMG items.

3. **Extra Life charity products are a hidden treasure trove.** Lost Laboratory of Kwalish (14 items) and Infernal Machine Rebuild (8 items) are official, paid DMsGuild products containing unique magic items not found in any print book. They are easily overlooked.

4. **Anthologies are high-value targets.** Each anthology (Tales from the Yawning Portal, Candlekeep Mysteries, etc.) contains items from multiple adventures. Researching one anthology book yields items from 6-17 adventures.

5. **Licensed starter sets need review.** The Stranger Things and Rick & Morty starter sets are official WotC products but their comedic/crossover nature and potential for duplicate SRD items requires case-by-case review.

6. **The 2024 rules introduce new item features.** Weapon masteries, crafting rules (potions and scrolls), and the Treasure Tags system change how items are defined and distributed. Items from 2014 sources may need updates for 2024 compatibility.

7. **Domains of Delight and Minsc and Boo's Journal of Villainy are pending review.** Both are substantial Extra Life charity products (DMsGuild) that likely contain magic items, but their exact contents need verification before inclusion.

---

## Methodology

- Web searches verified publication dates, content summaries, and item counts
- Sources were cross-referenced against multiple databases and community resources
- Only official first-party WotC products are included (including licensed partnerships like Critical Role, Penny Arcade, Stranger Things, and Rick and Morty)
- Third-party products (Kobold Press, etc.) are excluded
- Unearthed Arcana playtest content is excluded
- Adventurers League modules (DDAL/DDEX series) are excluded unless specifically noted as containing unique official items

---

## Next Steps (for other agents)

1. Research items from all "included" sources, starting with the highest-density sources (DMG 2014, DMG 2024, XGE, TCE)
2. Resolve the 3 "pending-review" sources: obtain copies and verify item contents
3. Cross-reference discovered items against the existing `src/data/items.json` catalog
4. Identify gaps where items exist in sources but not in the Forge & Fable catalog
5. For each item, record source attribution so provenance is traceable
