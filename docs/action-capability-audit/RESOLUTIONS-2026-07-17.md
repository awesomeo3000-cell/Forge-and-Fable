# Action capability audit resolutions — 2026-07-17

The former `unresolved.json` contained 12 historical review entries. Each was checked against current production data and code. The unresolved queue is now empty.

| Audit item | Resolution |
| --- | --- |
| Beast Master dual companion features | Current 2014 catalog grants only Ranger's Companion; Primal Companion is not simultaneously granted. |
| Monk mixed terminology | Corrected the 2014 feature description from focus points to ki points. |
| Arcane Domain empty subclass | Verified populated at levels 1, 2, 6, 8, and 17. |
| Cleric missing level-2 subclass feature | Verified `subclassFeatureLevels` is `[1, 2, 6, 8, 17]`. |
| Bard level-10 Expertise count | Verified two choices in `EXPERTISE_COUNTS`. |
| Rogue level-6 Expertise count | Verified two choices in `EXPERTISE_COUNTS`. |
| Rogue Sneak Attack static formula | Static text now describes Sneak Attack scaling; `classActionsAtLevel` remains the level-aware formula source. |
| Druid Archdruid description | Verified unlimited Wild Shape description is present. |
| Warlock level-12 invocation | Verified `More invocations` is granted at level 12. |
| Artificer level-6 infusion improvement | Verified `Infuse Item improvement` is granted at level 6. |
| Explicit subclass levels | Verified all 13 production classes declare their subclass-selection level. |
| Ranger simple-weapon proficiency | Verified simple and martial weapon proficiency are both present. |

Verification remains enforced by the rules research validator, progression tests, class progression tests, and the 1.0 release checklist.
