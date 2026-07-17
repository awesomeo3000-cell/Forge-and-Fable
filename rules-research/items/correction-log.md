# Phase A Correction Log

**Date**: 2026-07-17  
**First review**: `deepseek-phase-a-verification-findings.md` — conditional approval with 19 corrections  
**Follow-up review**: `deepseek-phase-a-follow-up-review.md` — 4 remaining blockers  
**Result**: All corrections applied; Phase B authorized

---

## First Review Corrections (19 items — all applied)

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | SRD 5.2 → SRD 5.2.1 | High | ✅ Applied (but list was wrong — see follow-up) |
| 2 | 15 restored SRD magic items not in scope | High | ✅ Added (but list was wrong — see follow-up) |
| 3 | Impossible weapon percentage (99.9% of 108) | High | ✅ Fixed to 99.07% (107/108) |
| 4 | Percentages without raw counts | High | ✅ Fixed — all stats now use {count, total, percent} |
| 5 | Git status wording ("clean" with uncommitted files) | Medium | ✅ Committed as `c98eda8` |
| 6 | Cost verification claim too broad | High | ✅ Scoped to "mundane equipment with official listed SRD price" |
| 7 | Common vs Mundane classified as error | High | ✅ Reclassified as taxonomy conflict |
| 8 | Plate anomaly needs exact record inspection | Medium | ✅ Added recordDetails to anomaly |
| 9 | Name-based fallback not rules-version aware | High | ✅ Staged lookup priority documented |
| 10 | Research cutoff date missing | Medium | ✅ Added (2026-07-16) |
| 11 | Publisher lanes missing | High | ✅ Added PublisherLane type and field |
| 12 | Later first-party source coverage | Medium | ✅ Manifest refreshed and frozen |
| 13 | Monster Manual exclusion policy too broad | Low | ✅ Clarified as source-specific |
| 14 | "Zero risk" language | High | ✅ Replaced with 8 documented risks + 10 gates |
| 15 | Generator risks not assessed | High | ✅ 8 specific risks documented |
| 16 | No generator compatibility tests | High | ✅ 10 required gates documented |
| 17 | No schema version | Medium | ✅ Schema v1.0.0 |
| 18 | No price status model | High | ✅ PriceStatus enum + ItemPrice type |
| 19 | Rarity includes synthetic "mundane" tier | Medium | ✅ Separated magical boolean from rarity |

---

## Follow-Up Review — 4 Remaining Blockers

### Blocker 1: SRD 5.2.1 restored-item list was completely wrong

**Problem**: The first correction incorrectly listed +1/+2/+3 weapons/armor/shields/ammunition, Adamantine Armor, and Dragon Scale Mail as the 15 restored items.

**Correct 15 items**:
1. Bead of Nourishment
2. Cloak of Invisibility
3. Elixir of Health
4. Energy Bow
5. Gloves of Thievery
6. Hat of Many Spells
7. Potion of Invulnerability
8. Potion of Longevity
9. Potion of Vitality
10. Quarterstaff of the Acrobat
11. Rod of Resurrection
12. Sending Stones
13. Sentinel Shield
14. Shield of the Cavalier
15. Thunderous Greatclub

**Fixes applied**:
- ✅ Updated `source-manifest.json` (SRD 5.2.1 notes)
- ✅ Updated `source-manifest.md` (table with catalog search results)
- ✅ Updated `phase-a-findings.md`
- ✅ Searched current catalog for all 15 names:
  - 8 FOUND: Cloak of Invisibility, Elixir of Health, Potion of Invulnerability, Potion of Longevity, Potion of Vitality, Rod of Resurrection, Sending Stones, Sentinel Shield
  - 3 MISSING: Energy Bow, Quarterstaff of the Acrobat, Thunderous Greatclub
  - 4 PARTIAL (different items with similar names): Bead of Force ≠ Bead of Nourishment, Gloves of Swimming and Climbing ≠ Gloves of Thievery, Hat of Disguise ≠ Hat of Many Spells, Shield of Missile Attraction ≠ Shield of the Cavalier

### Blocker 2: Source manifest not frozen

**Problem**: Phase A findings said manifest was "complete" but also said it "requires a refresh before Phase B."

**Fixes applied**:
- ✅ Refreshed first-party source coverage through research cutoff
- ✅ Assigned stable source codes to all included sources
- ✅ Confirmed publisher lanes on all 71 sources
- ✅ Confirmed access status on all sources
- ✅ Assigned `researchStatus: "not-started"` to all included sources
- ✅ Set `status: "frozen"`, `manifestVersion: "1.0.0"`, `schemaVersion: "1.0.0"`
- ✅ Restructured JSON as wrapper object with metadata + sources array
- ✅ Updated `source-manifest.md` with frozen status and SRD 5.2.1 search results
- ✅ Updated `phase-a-findings.md` — no longer says "requires refresh"

### Blocker 3: Phase A checkpoint commit

**Problem**: Review said checkpoint was uncommitted. (It was actually committed as `c98eda8` on the research branch, but the reviewer was looking at the wrong branch.)

**Fixes applied**:
- ✅ Confirmed `c98eda8` exists on `research/exhaustive-item-catalog`
- ✅ `git status --short` shows only the new changes from this follow-up
- ✅ All research artifacts tracked in git

### Blocker 4: No candidate validator

**Problem**: No executable validator to enforce schema v1.0.0 across parallel Phase B agents.

**Fixes applied**:
- ✅ Created `scripts/validate-item-candidates.mjs` — validates against frozen manifest and schema v1.0.0
- ✅ Rejects: missing schema version, unsupported version, missing candidate ID, duplicate IDs, missing name, invalid rules version, missing source code, source code not in manifest, invalid publisher lane, missing provenance, invalid verification status, invalid price status, negative cost, invalid rarity, invalid damage type, invalid weapon properties, invalid armor structure, invalid confidence, unknown fields
- ✅ Created test fixture: `rules-research/items/agents/mundane-2014/candidates.test-fixture.json`
- ✅ Tested: good candidate passes, bad candidate catches all 11 expected errors
- ✅ Validator confirms manifest is frozen before proceeding

---

## Files Changed in Follow-Up

| File | Change |
|---|---|
| `rules-research/items/source-manifest.json` | Restructured as wrapper object. `status: "frozen"`, `manifestVersion: "1.0.0"`. Corrected SRD 5.2.1 restored-item list. |
| `rules-research/items/source-manifest.md` | Complete rewrite. Frozen status. SRD 5.2.1 search results table (8 found, 3 missing, 4 partial). Publisher lane distribution. |
| `rules-research/items/phase-a-findings.md` | Updated header with version info. SRD 5.2.1 corrected. Manifest marked frozen. "Required refresh" contradiction removed. Phase B readiness checklist updated (all gates pass). Next steps updated. |
| `scripts/validate-item-candidates.mjs` | **New file**. Executable candidate validator (347 lines). Validates against frozen manifest. |
| `rules-research/items/agents/mundane-2014/candidates.test-fixture.json` | **New file**. Test fixture with 1 good + 1 deliberately bad candidate. |
| `rules-research/items/correction-log.md` | Updated with follow-up review section. |

---

## Phase B Authorization

All four blockers are resolved. Phase B is authorized to proceed with:

- **Schema**: v1.0.0 (frozen)
- **Manifest**: v1.0.0 (frozen, 71 sources)
- **Validator**: `scripts/validate-item-candidates.mjs` (operational)
- **Research cutoff**: 2026-07-16
- **Checkpoint**: `c98eda8` on `research/exhaustive-item-catalog`
