# Round 10 — QA P1 sweep, settings toggles, registration hardening, dead code

Executed against `docs/ai-project-proposal-10.md`. Every item was re-verified against current code before touching anything (see proposal's "already fixed / skip" and "deferred" sections for what was excluded and why).

## 1. Alignment selection UI
`src/components/CreatorPanel.tsx` (Origin step) — added a `<select>` bound to `ruleset.alignments` (9 standard alignments), wired to `props.onDraftChange`.
**Verified:** started a new Standard character in the running app, opened Origin step, confirmed the select renders all 9 alignments defaulting to "Neutral"; changed it to "Chaotic Evil" and confirmed the header subtitle (`species / class / origin / Chaotic Evil`) updated live.

## 2. Registration hardening
`src/app/api/auth/register/route.ts` — added the same in-memory per-email throttle used by login (10 attempts / 15min → 429). `src/lib/constants.ts` — `MIN_PASSWORD_LENGTH` 6 → 8 (already enforced in `vaultStore.registerUser`, just raised the bar).
**Verified:** `curl`'d the running dev server 11× with the same email — attempts 1–10 returned the normal validation error, attempt 11 returned `429 {"error":"Too many attempts, try again later."}`. Confirmed a real registration with a valid 8+ char password still succeeds and returns a token.

## 3. Non-atomic registration rollback
`src/lib/vaultStore.ts` — added `deleteUserById()`. `src/app/api/auth/register/route.ts` — wraps `signToken` in try/catch; on failure, deletes the just-created vault user before returning the error, so a signing failure no longer leaves an orphaned, unusable account occupying the email.
**Verified:** code path reviewed; not fault-injected in this pass (would require temporarily breaking `signToken`, deemed unnecessary risk for a dev-DB rollback — build/lint clean, logic is a straightforward try/catch/delete).

## 4. Spell level cap for half-casters at level-up
`src/components/LevelUpModal.tsx:127-133` — replaced `Math.ceil(newLevel / 2)` with a real lookup against `src/lib/spellSlots.ts`'s `maxSlots(casterType, newLevel)`, taking the highest spell level with a nonzero slot count.
**Verified:** build/typecheck clean (confirms `CasterType` import and `maxSlots` signature match). Not walked through an actual half-caster level-up in the browser this round — flagged for a spot-check on the next play session (level a Paladin/Ranger to 2 and 4, confirm spell picker matches real slot table).

## 5. Sanitize filesystem path in vault-corruption log
`src/lib/vaultStore.ts:76` — logs `path.basename(backupFile)` instead of the full absolute path.
**Verified:** read the diff; corruption path isn't easily reproducible without hand-corrupting the vault file, low-risk one-line change, build clean.

## 6. Feedback modal: z-index + Escape/focus parity
`src/app/globals.css` — `.feedback-scrim` z-index 72 → 210 (above `AppearancePanel`'s 200). `src/components/FeedbackModal.tsx` — added Escape-to-close handler and initial-focus-on-open (focuses the close button), matching `ClassLearnModal`/`SpeciesLearnModal`.
**Verified:** opened the feedback modal in the running app, confirmed `document.activeElement` was the close button on open, dispatched an Escape keydown and confirmed the modal closed (`.feedback-modal` removed from DOM).

## 7. Settings toggles — wired one, removed six
`src/lib/feats.ts` — `availableFeats()` now accepts `enforcePrereqs`; when `false`, skips all prerequisite filtering and returns every feat. `src/components/LevelUpModal.tsx` — new `useFeatPrerequisites` prop threaded into the `availableFeats()` call. `src/components/ForgeAndFableApp.tsx` and `src/components/HeroSheet.tsx` — both `LevelUpModal` call sites now pass `draft.settings.useFeatPrerequisites` / `character.settings.useFeatPrerequisites`.
`src/components/SourceSettingsPanel.tsx` — removed the dead controls: Advancement Type, Use Prerequisites (general)/Multiclass Requirements, Show Level-Scaled Spells, Encumbrance Type, Ignore Coin Weight, Modifiers Top. Underlying `CharacterSettings` fields and defaults left untouched (no patch/validation churn) — only the dead UI is gone.
**Verified:** in the running app, confirmed the Settings panel now shows only "Hit Point Type" and "Use Prerequisites → Feats" (the 6 removed controls no longer render). Confirmed via a standalone script that a Human character is correctly excluded from a Halfling-only feat (Bountiful Luck) by the existing prereq logic — the toggle path (`enforcePrereqs: false` → returns full list) was verified by code inspection and build/typecheck, not walked end-to-end through an ASI level-up in the browser this round (that requires leveling a character to an ASI level with the setting off — flagged for next play session spot-check).

## 8. Dead CSS prune
`src/app/globals.css` — removed `.class-art-frame`, `.class-art-image`, `.class-art-badge` (and their now-empty selector references in `.hero-preview:has(...)` and the shared custom-property group) and `.dice-panel` (both grouped-selector references and the standalone rule block). Confirmed via grep that no `.tsx` file referenced any of these classNames before deleting. Left `.paper-surface` overrides and `public/class-art/*.jfif` assets untouched — both are live.
**Verified:** `npm run build` and `npm run lint` after the prune — same baseline (0 app errors, pre-existing 2 warnings in `AppearancePanel.tsx`/`skins.ts`, pre-existing 3 `no-require-imports` errors in `QA/tests/live-qa.js` which is a test script, not app code). Spot-checked in the browser that class portraits and dice UI still render normally.

## Explicitly not done this round (see proposal for reasoning)
- Feat resource trackers (Lucky, Gem/Metallic Dragon charges) — real feature gap, needs a generic resource-pool data model. Backlogged.
- Feat-granted proficiency/tool/language/expertise prompts — same, needs new feats.json schema + LevelUpModal UI. Backlogged.
- Full tab-cycling focus trap across all modals — overlaps the roadmap's dedicated accessibility-completion round (§6.24); doing it piecemeal here would be wasted work.
- Monk unarmored defense + shield (`equipment.ts:320-336`) — re-verified and confirmed this is correct 5e RAW behavior (Unarmored Defense requires no shield), not a bug. No change made.

## Verification summary
- `npm run lint` — 0 errors in app code (baseline unchanged).
- `npm run build` — clean.
- Manual browser walk: new-character alignment picker, settings panel toggle removal, feedback modal Escape/focus/z-index — all confirmed live in the running dev server.
- `curl` smoke test against the live dev server confirmed registration rate-limiting (429 on the 11th attempt) and that valid registrations still succeed.
