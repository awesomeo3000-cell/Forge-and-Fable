# Phase A Correction Log

**Date**: 2026-07-17  
**Review**: `deepseek-phase-a-verification-findings.md`  
**Result**: Conditional approval — all required corrections applied

---

## Correction Summary

| # | Issue | Severity | File(s) Changed | Status |
|---|---|---|---|---|
| 1 | SRD 5.2 → SRD 5.2.1 | High | source-manifest.json, proposed-item-schema.ts, phase-a-findings.md | ✅ Fixed |
| 2 | 15 restored SRD magic items not in scope | High | source-manifest.json (SRD 5.2.1 notes), phase-a-findings.md | ✅ Added |
| 3 | Impossible weapon percentage (99.9% of 108) | High | profile-catalog.mjs, current-catalog-profile.md, current-catalog-profile.json, phase-a-findings.md | ✅ Fixed to 99.07% (107/108) |
| 4 | Percentages without raw counts | High | profile-catalog.mjs (rewrote to use {count, total, percent}), current-catalog-profile.json, current-data-anomalies.json | ✅ Fixed |
| 5 | Git status wording ("clean" with uncommitted files) | Medium | phase-a-findings.md | ✅ Pending commit |
| 6 | Cost verification claim too broad | High | current-catalog-profile.md (scoped to "mundane equipment with official listed SRD price"), proposed-item-schema.ts (added PriceStatus model) | ✅ Fixed |
| 7 | Common vs Mundane classified as error | High | current-data-anomalies.json (reclassified as "taxonomy-conflict"), current-catalog-profile.md, schema-decision-log.md, phase-a-findings.md | ✅ Reclassified |
| 8 | Plate anomaly needs exact record inspection | Medium | profile-catalog.mjs (added recordDetails to anomaly), current-catalog-profile.md | ✅ Fixed |
| 9 | Name-based fallback not rules-version aware | High | id-compatibility-report.md (added staged lookup priority, required rule, CanonicalItemIdentity) | ✅ Fixed |
| 10 | Research cutoff date missing | Medium | source-manifest.json (added researchCutoff field), phase-a-findings.md | ✅ Added |
| 11 | Publisher lanes missing | High | source-manifest.json (added publisherLane to all entries), proposed-item-schema.ts (added PublisherLane type), schema-decision-log.md | ✅ Added |
| 12 | Later first-party source coverage | Medium | phase-a-findings.md (noted required refresh before Phase B) | ✅ Documented |
| 13 | Monster Manual exclusion policy too broad | Low | phase-a-findings.md (clarified source-specific policy) | ✅ Clarified |
| 14 | "Zero risk" language | High | schema-migration-options.md (replaced with 8 documented risks + 10 required gates), phase-a-findings.md | ✅ Fixed |
| 15 | Generator risks not assessed | High | schema-migration-options.md (added 8 specific generator risks: ID loss, field flattening, ordering, null handling, variant collapse, collisions, stale files, non-determinism) | ✅ Fixed |
| 16 | No generator compatibility tests | High | schema-migration-options.md (added 10 required gates including deterministic generation, snapshot test, compatibility test, CI checks) | ✅ Documented |
| 17 | No schema version | Medium | proposed-item-schema.ts (v1.0.0), schema-decision-log.md (Decision 14), phase-a-findings.md | ✅ Added |
| 18 | No price status model | High | proposed-item-schema.ts (added PriceStatus, ItemPrice types), schema-decision-log.md (Decision 1 revised) | ✅ Added |
| 19 | Rarity includes synthetic "mundane" tier | Medium | proposed-item-schema.ts (removed "mundane" from CanonicalRarity; added ItemMagicClassification), schema-decision-log.md (Decision 6 revised) | ✅ Fixed |

---

## Files Changed

| File | Change Summary |
|---|---|
| `scripts/profile-catalog.mjs` | Rewrote to use `{count, total, percent}` for all empty-field and weapon stats. Added `anomalyType` and `rawCount`/`totalEligible` to every anomaly. Added Plate record details. Reclassified Common/Mundane as `taxonomy-conflict`. |
| `rules-research/items/source-manifest.json` | SRD 5.2 → 5.2.1 with notes about 15 restored magic items. Added `publisherLane` to all 71 entries. Added `researchCutoff` and wrapper metadata. |
| `rules-research/items/proposed-item-schema.ts` | Schema v1.0.0. Added `PriceStatus`, `ItemPrice`, `PublisherLane`, `CanonicalRarity`, `ItemMagicClassification`, `CanonicalItemIdentity`. Removed `"mundane"` from rarity enum. Added `magical: boolean`. Separated rarity from magic classification. Updated license to `"srd-5.2.1"`. Added `_legacyRarity` bridge field. |
| `rules-research/items/current-catalog-profile.json` | Regenerated with raw counts in all statistics. Added `weaponStats` and `armorStats` sections. |
| `rules-research/items/current-catalog-profile.md` | Fixed weapon percentage (99.07%). Added raw counts to all tables. Scoped cost verification claim. Reclassified Common/Mundane as taxonomy conflict. Added price status explanation. Incorporated Plate inspection requirement. |
| `rules-research/items/current-data-anomalies.json` | Regenerated with `anomalyType`, `rawCount`, `totalEligible` on all entries. Reclassified "Common/Mundane" as `taxonomy-conflict`. Added `recordDetails` to Plate anomaly. |
| `rules-research/items/id-compatibility-report.md` | Added §3: risks of dual-version records. Added staged lookup priority (6 levels). Added required rule: never bind 2014 to 2024 by name alone. Added `CanonicalItemIdentity` recommendation. |
| `rules-research/items/schema-migration-options.md` | Replaced "zero risk" with 8 documented generator risks. Added 10 required gates before production use. Added deterministic generator implementation sketch. Changed risk assessment from "LOW" to "LOW-MEDIUM". |
| `rules-research/items/schema-decision-log.md` | Added Decisions 11-14 (SRD version tracking, publisher lanes, research cutoff, schema versioning). Revised Decisions 1 (price status model) and 6 (separated rarity from magic classification). |
| `rules-research/items/phase-a-findings.md` | Full regeneration with all corrections. Added raw counts, SRD 5.2.1, taxonomy conflict classification, price status model, publisher lanes, generator gates, corrected weapon percentage, rules-version–aware fallback, and Phase B readiness checklist. |

---

## Verification Status

All 19 items from the pre-Phase-B checklist are addressed. The remaining items are:

- ⬜ Commit Phase A checkpoint (pending — requires `git add` + `git commit`)
- ⬜ Refresh later first-party source coverage in manifest (deferred to Phase B agent)
- ⬜ Implement generator + tests (deferred to Phase D implementation)

These deferred items are documented in `phase-a-findings.md` and will be addressed in their respective phases.
