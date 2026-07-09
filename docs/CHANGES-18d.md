# CHANGES-18d — Sweep and kill list

**Round:** R18 "The Ledger", sub-round d (proposal: `ai-project-proposal-18.md` §3/18d)
**Files touched:** `src/components/QuickbuilderPanel.tsx` (rewritten), `src/components/ClassLearnModal.tsx`, `src/components/SpeciesLearnModal.tsx`, `src/components/SpeciesFamilyModal.tsx`, `src/app/globals.css` (append-only, `/* ── 18d ── */` under the R18 banner)

## 1. QuickbuilderPanel

Rewritten onto `ledger-page` + `.ledger-option` rows + `ledger-button`. **No logic changes** — `step`/`fightStyle`/`classId`/`raceId`/`charName` state, `canContinue`, `buildQuickDraft`, and `onComplete`/`onCancel` wiring are identical. Visible changes:
- Both branches (premade, three-question) use the ledger page header with eyebrow/double-rule; existing header copy kept (it already fit the register).
- Fight styles and species are neutral-dot rows; classes and premade archetypes carry the `--class-a` seal dot via `data-class`. Class rows use the §2 `CLASS_DESCRIPTORS`; species rows use `firstSentence(summary, 60)`; premades show `{Class} · {Species} — {summary}`.
- The `STYLE_ICONS` lucide map (`Swords`/`Wand2`/`Eye`/`Heart`) and every `ChevronRight` are deleted; zero lucide imports remain in this file.
- Button labels: `Previous question` / `Record the answer` / `Review the record` (replacing "Continue"/"Review & Finalize" — §2 bans "Continue" and arrow glyphs in labels; new strings match the register). `aria-pressed` retained on all rows; disabled gating unchanged. Name placeholder now `Write a name` (matches Chapter I).

## 2. The three Learn/family modals

Dark scrim kept. Each modal `<section>` gained `ledger-page` beside its existing classes — combined with the `.ledger-page` paper-token re-point (added this sub-round, mirroring 18c's spread re-point), the modal body renders as ledger paper with grain. Hero header gets a hairline bottom rule with the source/count line as a small-caps eyebrow; the class/species icon stage becomes a flat wax-seal circle (`--class-a` mixed 75% toward ink — the paper-color landmine — no gradient, no glow). Detail cards become hairline-ruled sections; the `ChevronRight` disclosure glyphs are replaced by a text `›` that rotates when open (CSS transition, disabled under `prefers-reduced-motion`). Footer buttons became `ledger-button` (Back) / `ledger-button-primary` (Choose/Keep), arrows removed. The family modal's `chosen` badge reads `sealed ✦`. Focus-trap (`useFocusTrap`), Escape handling, focus-return, `aria-modal`/`aria-labelledby`/`role="dialog"`, and the ✕ close (lucide allowed here) are all untouched — the ✕ only sheds its glass pill (transparent, circle hover tint).

## 3. Kill sweep — greps run and what they found

Across the touched surfaces (`CharacterStartPanel`, `CreatorPanel`, `QuickbuilderPanel`, the three modals, `ForgeAndFableApp` top bar/rail):
- `lucide-react` imports: only `X` in the three modals (allowed close ✕) and the top-bar action icons in `ForgeAndFableApp` (`Swords`/`MessageSquare`/`LogOut` — allowed) remain. `Sparkles`, `UserRound`, `Upload`, `Plus`, `ShieldCheck`, `CircleGauge`, `ChevronRight`, `Dices`, `Gem`, `Minus`, `Pencil`, `Save`, `ScrollText`, `Wand2`, `Eye`, `Heart` all removed from these surfaces.
- `dj-card-tab` / `dj-card-grid` / `dj-mode-card` / `dj-option-card` / `dj-family-chevron`: zero hits in the touched components (their CSS definitions remain in place, untouched, per §0.3).
- `backdrop-filter`: zero non-`none` occurrences in the entire stylesheet (glass was already dead CSS-wide; §0's glass references were historical).
- Radii on touched surfaces: legacy pill/rounded rules that still reached them were overridden at the end of the R18 block — modal ✕ glass pill → transparent circle, `system-status` chip → plain italic text, `points-pill` → flat small-caps counter, `final-loadout` pills → hairline italic entries, `account-chip` → plain small-caps (18a). New R18 rules use only 0 / 3px (`--r-sm`) / 50% circles.
- Gradient backgrounds: the modal `class-icon-stage` radial/linear gradients are overridden to flat seal circles; `brand-glyph` (gradient) was deleted from the masthead in 18a. Remaining gradient rules in globals.css belong to untouched surfaces (auth screen, sheet, campaign panel).

## 4. Regression pass

- `npx tsc --noEmit` clean; `npm run lint` 0 errors (one pre-existing unrelated warning); **`npm run build` clean** (all 21 routes).
- Not touched by any R18 edit (verified by diff scope): `HeroSheet.tsx`, all `cs-*` CSS, `RollDrawer.tsx`, campaign/toast CSS, `LevelUpModal.tsx`, `CharacterImportModal.tsx`, and every existing `globals.css` block (the R18 work is 100% appended; the only JSX-side class *removals* are `paper-surface` on the two rewritten panel roots and the swapped button/row classes documented above — old class definitions all survive for the surfaces that still use them).
- **Honest gap (same as 18a–c):** the in-browser open-each-surface pass (sheet, campaigns panel, toasts, roll drawer, level-up modal, PDF import) and screenshots could not be executed by the implementer — the permission classifier blocked all access to the running dev server. `scripts/r18-seed.mjs` seeds a two-character reviewer account (`r18-review@test.local` / `ledger-review-18!`) for whoever runs the review gate (§4).
