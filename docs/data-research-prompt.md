# Research prompt — build the master data document

Paste everything below the line into a capable research AI (one that can look things up). It will produce a single master JSON file containing the two datasets we still need: **subclass features by level**, and **spell-to-class lists**.

---

You are a Dungeons & Dragons 5th Edition (2014 ruleset) data researcher. Produce **one master JSON document** containing two datasets for a character-sheet app. Use official D&D 5e sources (Player's Handbook, Xanathar's Guide to Everything, Tasha's Cauldron of Everything, and other official sourcebooks). **Paraphrase every description in your own words — concise, 1–3 sentences, mechanically accurate (say what the feature does, not just flavor). Do not copy any text verbatim.**

Output **valid JSON only** — a single object with exactly two top-level keys, and no prose outside the JSON:

```json
{
  "subclassFeatures": { ... },
  "spellClassLists": { ... }
}
```

## Part 1 — `subclassFeatures`

For all 13 classes and every one of their official subclasses, list each **subclass feature by level**.

Shape:

```json
"subclassFeatures": {
  "barbarian": {
    "path-of-the-berserker": [
      { "level": 3, "name": "Frenzy", "description": "While raging you can frenzy to make a bonus-action melee attack each turn, but gain exhaustion when the rage ends.", "source": "PHB", "uncertain": false },
      { "level": 6, "name": "...", "description": "...", "source": "PHB" }
    ]
  }
}
```

Rules for Part 1:
- **Key by class id** = lowercase class name: `artificer, barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard`.
- **Key each subclass by a slug** = the official subclass name lowercased with spaces/punctuation replaced by hyphens (e.g. `College of Lore` → `college-of-lore`, `Path of the Berserker` → `path-of-the-berserker`, `Oath of Devotion` → `oath-of-devotion`). Use the exact official subclass names — they will be matched to our data by this slug.
- **Include every official base + supplement subclass** for each class (aim for completeness — roughly 116 subclasses total).
- For each subclass, include a feature entry **for each level that class gains a subclass feature** (table below). If a subclass grants additional features at other levels (e.g. bonus/expanded spells, extra abilities), include those too at their correct level.
- Every entry needs `level`, `name`, `description`, and `source` (book abbreviation). Add `"uncertain": true` on any entry you are not confident about rather than guessing.

**Levels each class gains a subclass feature** (use these as the required levels per class):

| Class | Subclass chosen at | Feature levels |
|---|---|---|
| Artificer | 3 | 3, 5, 9, 15 |
| Barbarian | 3 | 3, 6, 10, 14 |
| Bard | 3 | 3, 6, 14 |
| Cleric | 1 | 1, 6, 8, 17 |
| Druid | 2 | 2, 6, 10, 14 |
| Fighter | 3 | 3, 7, 10, 15, 18 |
| Monk | 3 | 3, 6, 11, 17 |
| Paladin | 3 | 3, 7, 15, 20 |
| Ranger | 3 | 3, 7, 11, 15 |
| Rogue | 3 | 3, 9, 13, 17 |
| Sorcerer | 1 | 1, 6, 14, 18 |
| Warlock | 1 | 1, 6, 10, 14 |
| Wizard | 2 | 2, 6, 10, 14 |

## Part 2 — `spellClassLists`

For every official 5e spell, list which classes have it on their spell list.

Shape:

```json
"spellClassLists": {
  "Fireball": ["Sorcerer", "Wizard"],
  "Cure Wounds": ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger"],
  "Eldritch Blast": ["Warlock"]
}
```

Rules for Part 2:
- **Key by the spell's exact official name** as printed (Title Case). Names will be matched to our spell dataset by a slug of this name, so spelling must be correct.
- Values are the classes that can cast the spell, capitalized: `Artificer, Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard`.
- Cover as many spells as possible — aim for the full official spell list (500+). Include subclass-granted "always prepared"/domain/expanded spells only if you also note them; otherwise stick to the base class lists.

## Quality bar

- **Accuracy over completeness.** If unsure of a feature's level, a subclass name, or a spell's class list, set `"uncertain": true` (Part 1) or omit the doubtful class (Part 2) rather than inventing.
- Paraphrase all feature descriptions; do not reproduce book text.
- Output must be a single valid JSON object with the two keys above and nothing else.
- If the response would be too long, continue in additional messages, keeping the JSON structure intact so the parts can be concatenated.

Deliver the result as a single downloadable JSON file named `dnd-master-data.json`.
