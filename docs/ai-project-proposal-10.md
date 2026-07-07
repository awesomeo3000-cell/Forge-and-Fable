# Round 10 Proposal — QA P1 sweep + settings toggles + registration + dead code

**Context:** First round after `docs/ROADMAP-1.0.md` was written. Covers roadmap §2.1 (QA P1 sweep, 11 issues), §2.4 (unwired settings toggles), §2.5 (non-atomic registration), §2.7 (dead code/CSS prune). Every item below was re-verified against current code (two independent passes) before being scoped in — the QA report is known to over-count and self-inflict, so anything already fixed or not actually a bug is called out and skipped rather than "re-fixed."

**Tier:** DS (mechanical, fully specced below).

---

## Pre-verified: already fixed, skip

- Feedback modal CSS (`globals.css:1965-2282`) — all classes exist, fully styled. Report was stale.
- `raceName` wired into creation-flow LevelUpModal (`ForgeAndFableApp.tsx:1126,1139`) — already passed as a prop.
- Modal Escape-key handling + `role="dialog"`/`aria-modal` — present on ClassLearnModal, SpeciesLearnModal, LevelUpModal. (FeedbackModal is the one gap — see Task 6.)
- Monk unarmored defense + shield (`equipment.ts:320-336`) — **not a bug**. Monk's Unarmored Defense (10+DEX+WIS) is RAW-gated on wielding no shield; falling through to the generic 10+DEX+shield branch when a shield is equipped is correct 5e behavior. No change.

## Explicitly deferred (feature work, not a P1 bug fix)

- **Feat resource trackers** (Lucky's 3/long-rest reroll, Gem/Metallic Dragon feat charges, etc.) — real gap, but needs a generic resource-pool data model + UI, not a bounded fix. Add to §3 rules-engine backlog for its own round.
- **Feat-granted proficiency/tool/language/expertise prompts** — same reasoning; needs new `grantsProficiency`/`grantsTool`/`grantsLanguage` schema on feats.json plus LevelUpModal UI. Own round.
- **Full focus-trap (tab-cycling) across all modals** — overlaps §6.24 accessibility-completion round already on the roadmap; doing it piecemeal here would duplicate work. FeedbackModal gets Escape+aria-modal parity now (cheap); full trap waits for §6.24.

---

## Tasks

### 1. Alignment selection UI
**File:** `src/components/CreatorPanel.tsx` (Origin step, ~line 314), possibly `src/lib/utils.ts` for the alignment list constant.
Currently `<StepSlot value={props.draft.alignment} label="alignment" />` is read-only display; `draft.alignment` is never set by the user, so it's always whatever the default is ("Neutral").
**Fix:** Add a `<select>` (or button-tab group, matching existing `StepSlot`/tab UI conventions in the file) with the 9 standard alignments (Lawful/Neutral/Chaotic × Good/Neutral/Evil), wired to `onSettingsChange`-style draft update, same pattern used for other Origin-step fields in the same file.
**Acceptance:** Alignment is selectable in the builder, persists to the character, displays correctly on the sheet.

### 2. Registration hardening
**File:** `src/app/api/auth/register/route.ts`, `src/lib/constants.ts` (`MIN_PASSWORD_LENGTH`).
Currently: no rate limiting at all on `/api/auth/register`; `MIN_PASSWORD_LENGTH = 6` exists but is referenced — recheck exact enforcement path before assuming broken (one agent pass found it enforced at register/route.ts line ~126, the other found no reference — resolve by reading the file directly during implementation).
**Fix:** Mirror the existing login rate limiter (`src/app/api/auth/login/route.ts`, 10/15min in-memory) for register — same mechanism, new counter keyed by IP. Bump `MIN_PASSWORD_LENGTH` to 8 (NIST minimum) if not already ≥8, confirm it's actually checked before `registerUser` runs.
**Acceptance:** Rapid repeated registration attempts from one IP get throttled with the same error shape as login; passwords under 8 chars are rejected.

### 3. Non-atomic registration rollback
**File:** `src/app/api/auth/register/route.ts`, `src/lib/vaultStore.ts` (`registerUser`).
Current order: vault write (user created) happens, *then* `signToken`. If signing throws, the user is already persisted but the client never gets a token — orphaned, unusable account, and the email is now "taken" forever.
**Fix:** Wrap `signToken` in try/catch; on failure, delete the just-created user from the vault before returning the error (best-effort rollback — this is the existing no-lock vault, so treat it the same as any other vault write).
**Acceptance:** Simulate a signing failure (throw temporarily) and confirm the user does not survive in the vault after the request fails; re-registering the same email succeeds.

### 4. Spell level cap for half-casters at level-up
**File:** `src/components/LevelUpModal.tsx:128`.
Currently `s.level <= Math.ceil(newLevel / 2)` — a naive approximation, wrong for half-casters (paladin/ranger get no slots until level 2, and the ceil formula doesn't match actual slot progression).
**Fix:** Replace with a real lookup against `src/lib/spellSlots.ts` (`maxSlots()`/equivalent already used elsewhere, e.g. `equipment.ts`'s `preparedSpellLimit`) to get the caster's actual highest available spell level at `newLevel`, keyed by caster type (full/half/pact).
**Acceptance:** Level-up spell picker shows only spell levels the character can actually cast per class/caster-type progression, at level 1 and at a half-caster's level 2 breakpoint.

### 5. Sanitize filesystem path in vault-corruption log
**File:** `src/lib/vaultStore.ts:76`.
`console.error(\`⚠️ Corrupted vault backed up to ${backupFile}\`)` logs the full absolute server path.
**Fix:** Log only the filename (`path.basename(backupFile)`), not the full path.
**Acceptance:** Log line no longer contains the absolute directory.

### 6. Feedback modal: z-index + Escape/focus parity
**File:** `src/app/globals.css` (`.feedback-scrim`, currently z-index 72), `src/components/FeedbackModal.tsx`.
Feedback modal (72) renders behind AppearancePanel (200) when both could plausibly be open.
**Fix:** Raise `.feedback-scrim` z-index above 200 (e.g. 210, consistent with existing scale). Add Escape-to-close handler to `FeedbackModal.tsx` matching the pattern in `ClassLearnModal.tsx`/`SpeciesLearnModal.tsx`, plus initial-focus-on-open (focus the modal or first field) for parity with the other three modals — not a full tab-trap (see deferred list).
**Acceptance:** Feedback modal renders above AppearancePanel when both stacked; Escape closes it; opening it moves focus into it.

### 7. Settings toggles — decide per toggle
**File:** `src/components/SourceSettingsPanel.tsx`, `src/types/game.ts`, `src/lib/utils.ts` (defaults), `src/lib/feats.ts`.
Verified: only `hitPointType` has a real consumer (creation flow). `advancementType` only wires to its own dropdown (no-op). The other 7 (`usePrerequisites`, `useFeatPrerequisites`, `useMulticlassPrerequisites`, `encumbranceType`, `ignoreCoinWeight`, `showLevelScaledSpells`, `modifiersTop`) are pure dead checkboxes — defined, rendered, never read.

Decisions (pre-made, no judgment calls left for the implementer):
- **`useFeatPrerequisites`** — WIRE IT. `feats.ts`'s `availableFeats()` (racial/ability/chain prereq checks) currently runs unconditionally. Thread the toggle through so that when `false`, `availableFeats()` skips all prereq filtering and returns the full feat list. This is the one roadmap explicitly calls out as "prereqs ARE enforced — wire the toggle or remove it."
- **`usePrerequisites`** — REMOVE from `SourceSettingsPanel.tsx`. No general prerequisite system exists to gate (distinct from the feat-specific one above); nothing to wire.
- **`useMulticlassPrerequisites`** — REMOVE from UI. Multiclassing doesn't exist yet (roadmap §3.14, its own future round); toggle would gate a feature that isn't there.
- **`advancementType`** — REMOVE from UI. XP-based advancement is roadmap §3.13 (future round); the field stays in the type/defaults for forward compat, just no dead control shown now.
- **`encumbranceType`**, **`ignoreCoinWeight`** — REMOVE from UI. Encumbrance is roadmap §3.11 (future round, sequenced R11); same reasoning.
- **`showLevelScaledSpells`** — REMOVE from UI. No consumer, no spec for what it should highlight; not worth inventing behavior for a checkbox nobody asked to keep.
- **`modifiersTop`** — REMOVE from UI. No consumer; reversing ability-mod/score display order would touch sheet layout CSS for a feature with no current demand.

For every "REMOVE" toggle: delete its section/control from `SourceSettingsPanel.tsx` only. Leave the field in `CharacterSettings` (`types/game.ts`) and its default in `utils.ts` untouched — existing persisted characters still round-trip the field harmlessly; just stop showing dead UI. Do not delete the type fields (avoids touching `ALLOWED_PATCH_FIELDS`/validation for no reason).

**Acceptance:** Settings panel no longer shows the 6 dead controls; `useFeatPrerequisites` toggle actually changes which feats are offered at level-up/creation (test: disable it, confirm a feat with an unmet racial/ability prereq now appears).

### 8. Dead CSS prune
**File:** `src/app/globals.css`.
Verified dead (no `.tsx` references the class names): `.class-art-frame`, `.class-art-image`, `.class-art-badge` (and the `:has(.class-art-frame)` / grouped selector variants), `.dice-panel`.
**Fix:** Delete these rule blocks. Do NOT touch `.paper-surface` overrides or the `.jfif` assets in `public/class-art/` — both are confirmed live (referenced by `src/lib/utils.ts:32-43` and by still-existing components).
**Acceptance:** `npm run build` and `npm run lint` stay clean; visually spot-check class-art portraits and dice UI still render (they should, since only orphaned rules are removed).

---

## Verification requirements (all tasks)
- `npm run lint` — 0 errors (baseline: 0 errors, 1 warning per roadmap header — do not introduce new warnings).
- `npm run build` — clean.
- Manual walk in the running app: create a character and set alignment; attempt rapid registrations to confirm throttling; level up a half-caster past a slot breakpoint; open the feedback modal over the appearance panel and confirm stacking + Escape; open Settings and confirm the 6 toggles are gone and Feat Prerequisites actually gates a feat.
- One entry per task in `docs/CHANGES-10.md` — what changed, what was clicked, what was observed. No entry = not done.
