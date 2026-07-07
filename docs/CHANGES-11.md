# Round 11 — Tool proficiencies, languages, currency & encumbrance

Executed against `docs/ai-project-proposal-11.md`. §3.13 (XP advancement) intentionally skipped per user direction — treated as a DM/table decision outside the app's scope.

## Scoping decision: item weight data
`items.json` (541 items) has no `weight` field on any entry, and hand-authoring accurate weights for all of them was judged too large/error-prone for this round (confirmed via `AskUserQuestion` with the user). Scoped to: real PHB weights on the ~29 static armor/weapon entries in `equipment.ts` (the gear that actually drives most encumbrance), plus an optional weight field on manually-added inventory items. The 541-item catalog gets no weight data yet — a documented follow-up, not silently dropped.

## Part A — Tool proficiencies & languages
- `src/lib/srd.ts` — added `LANGUAGES`, `TOOLS`, `CLASS_TOOL_GRANTS`, `CLASS_TOOL_CHOICES`, `BACKGROUND_TOOL_GRANTS`, `BACKGROUND_TOOL_CHOICES`, `BACKGROUND_LANGUAGE_CHOICES` (5e PHB tool/language grants per class and background).
- `src/types/game.ts` — `Character.toolProficiencies?`/`languages?`, `DraftCharacter.toolProficiencies`/`languages`, new `Currency` type.
- `src/lib/validateCharacter.ts` — whitelisted + validated the new fields (string arrays capped at 40 entries, 64 chars each).
- `src/components/CreatorPanel.tsx` — Class step shows fixed tool grants + a choice picker (Bard: 3 instruments, Monk: 1 tool, Artificer: fixed thieves'/tinker's + 1 artisan choice); Origin step shows background tool grants/choices (Criminal/Soldier) and language choices (Acolyte/Sage: 2 each). Picks reset correctly when class/background changes mid-wizard; two independent choice pools (class + background) can be active at once without competing for the same slot count.
- `src/lib/utils.ts` (`characterPayload`) — merges fixed class/background tool grants with the player's chosen picks into the final `toolProficiencies` array at character creation.
- `src/components/HeroSheet.tsx` — "Proficiencies & Training" section now shows Tools and Languages groups.
- `src/lib/quickbuild.ts` — updated to satisfy the new required `DraftCharacter` fields.

**Verified:** created a Bard/Sage character in the running app. Confirmed the tool picker offered all 10 musical instruments, enforced the 3-pick limit (disabling the remaining 7 once 3 were chosen), and the language picker enforced its 2-pick limit the same way. After creation, the sheet's Proficiencies & Training section showed `Tools: Flute, Lute, Lyre` and `Languages: Draconic, Celestial` correctly.

## Part B — Currency & encumbrance
- `src/types/game.ts` — new `Currency` type; `InventoryItem.weight?`.
- `src/lib/equipment.ts` — real PHB weights added to all 12 armors, 17 weapons, `SHIELD_WEIGHT = 6`; `inventoryWeaponToDef` falls back to the matched static weapon's weight. New `totalCarriedWeight()` (inventory + static equipped gear + coin weight, honoring `ignoreCoinWeight`) and `carryCapacity()` (STR×15 standard, or 5×/10×/15× thresholds under variant rules; `null` when disabled) helpers.
- `src/components/SourceSettingsPanel.tsx` — re-added `encumbranceType`/`ignoreCoinWeight` controls (removed in R10 as dead toggles; now wired to a real feature).
- `src/components/HeroSheet.tsx` — new currency panel (cp/sp/ep/gp/pp inputs) at the top of the Inventory tab, with a carry-weight line and encumbered/heavily-encumbered/over-capacity messaging under variant rules. Manual "Add item" form gained an optional weight (lb) input.
- `src/lib/validateCharacter.ts` — `currency` validated as an object of 5 non-negative integers.

**Verified:** in the running app, set GP to 500 on a fresh character — carry weight correctly showed `10.0 lb` (500/50). Equipped Plate armor (65 lb) — carry weight updated to `75.0 / 135 lb` (STR 9 × 15 = 135 capacity). Confirmed the currency panel renders all 5 denominations and persists via `onUpdate`.

## Verification summary
- `npm run lint` — 0 errors in app code (same baseline: pre-existing 3 `no-require-imports` errors in `QA/tests/live-qa.js`, 2 pre-existing warnings).
- `npm run build` — clean.
- Manual browser walk covering both features end-to-end as described above; test character removed from the vault after verification.
