# Forge & Fable mobile responsiveness audit

Date: 2026-07-14
Status: baseline audit complete; P0/P1 remediation pass 1 implemented and live-verified

## Scope and method

This first pass covered the shared application shell, home dashboard, Forge start surface, Hero empty state, live DM Table, character-builder CSS, character-sheet CSS, roll drawer, campaign/feedback/import modal rules, and the responsive media-query cascade.

Evidence came from:

- Static inspection of `src/components/ForgeAndFableApp.tsx`, `src/components/DMTablePanel.tsx`, `src/components/RollDrawer.tsx`, `src/app/globals.css`, and `src/app/arcane-observatory.css`.
- Live browser checks at 390x844 and 320x844 against the local app. A temporary isolated DM campaign/account was used for the post-change Table check, then removed; existing user campaign data was preserved.
- Repository validation: 264 tests passed, production build passed, and typecheck passed after the build regenerated Next route types.

## Executive result

The home, Forge start, and Hero empty states fit within the viewport without page-level horizontal overflow. After pass 1, the live DM Table also fits as a single-column surface at 320px, 360px, 390px, and 430px: the document reports no horizontal overflow at every audited width, and the encounter controls remain inside the available content column. The shared mobile shell now uses a 62px header at both widths, with 40px action targets and a compact 320px navigation row.

## P0/P1 remediation pass 1

Implemented in `src/app/arcane-observatory.css`:

- P0 DM Table: reasserts the one-column mobile grid in the final Observatory cascade, including the higher-specificity encounter layout; removes child minimum-width pressure; constrains the encounter, stage, party, inspector, soundboard, and action surfaces to the available column; and allows the Table header controls to wrap.
- P1 shared shell: changes the narrow Observatory masthead to a compact flex row, hides the repeated account label, keeps the action buttons at 40px square targets, and preserves the existing rail visual language.
- P1 320px navigation: keeps the four primary actions in a 44px-class touch target row while reducing only the label density and inter-item spacing needed at the smallest audited width.

Live verification after the change confirmed the shared shell at 390px and 320px: the home top bar is 62px tall instead of 206px, the page remains exactly the viewport width, the three action buttons are 40px square, and the 320px primary navigation items remain 52px wide by 46px high. A clean DM session then verified the Table directly at both widths.

## Prioritized findings

The P0/P1 measurements below are the pre-remediation baseline that drove pass 1. The current post-remediation measurements are recorded in the P0 section and in the validation baseline.

### P0 — DM Table has an intrinsic-width mobile failure

Live evidence at 390px:

- `.dm-table`: client width 375px, scroll width 794px.
- `.dm-table-grid`: 335px wide.
- `.dm-table-region`: 480px wide and begins at x=314.
- `.dm-stage`: 442px wide and begins at x=333.
- The document reports 390px page width only because the table owns the overflow in its fixed scroll container.

The mobile media query does collapse the grid to one column, but the encounter region and stage retain desktop-sized intrinsic widths. This leaves the main encounter controls off-canvas and makes the mobile table dependent on horizontal scrolling.

Primary code locations:

- `src/app/globals.css:12430` establishes the 270/480/340 minimum-width workspace columns.
- `src/app/globals.css:12493-12499` collapses the grid but does not remove the child minimum-content width.
- `src/app/globals.css:12753-12761` repeats the theme overrides and mobile collapse.
- `src/components/DMTablePanel.tsx` and `src/components/dmTable/` own the affected regions.

Recommended first fix: define a mobile table contract for the encounter region, stage, action toolbar, and inspector. Every child must be `min-width: 0`; wide control groups should wrap or become horizontal scrollers with visible affordance; the inspector should be an explicit sheet/drawer rather than contributing hidden intrinsic width.

Post-remediation evidence:

- At 390px, the document was exactly 390px wide, the Table content column was 366px, and the grid resolved to one `366px` column. No descendant extended beyond the document viewport.
- At 320px, the document was exactly 320px wide, the Table content column was 281px, and the grid resolved to one `281px` column. No page-level overflow remained.
- At 360px, the document was exactly 360px wide, the Table content column was 336px, and the grid resolved to one `336px` column. No page-level overflow remained.
- At 430px, the document was exactly 430px wide, the Table content column was 406px, and the grid resolved to one `406px` column. No page-level overflow remained.
- The only remaining overflow was the intentional `.dm-workspace-modes` inner rail: its 350px scroll width is contained inside the 281px column so all four mode buttons remain reachable without widening the page.

The 360px pass also confirmed that the only descendant extending past the viewport is the `Session review` button inside that same intentional horizontal mode rail; the document itself remains exactly 360px wide.

### P1 — Shared mobile shell consumes too much vertical space

At 390px and 320px, the shell is:

- top navigation strip: 64px;
- mobile top bar: 206px;
- main content begins at y=270px.

The three header actions stack into a 138px-wide column of 38px controls. This is technically contained, but it pushes the actual dashboard/builder surface far below the fold and repeats on every route.

Primary code locations:

- `src/components/ForgeAndFableApp.tsx:2106-2182` renders the shared shell and action cluster.
- `src/app/arcane-observatory.css:1593-1634` converts the rail to a top strip but leaves the top-bar/actions stack intact.
- `src/app/globals.css:3098-3104` and `src/app/globals.css:3188-3200` make the top bar/actions grid and full-width on narrow screens.

Implemented in pass 1: create a compact mobile header row, hide the repeated account label, preserve 40px action targets, and keep the existing Observatory visual language.

### P1 — 320px navigation is technically fitting but too compressed

At 320px, the four primary navigation items are approximately 49px wide each. They remain in one row beside the brand and account button, so labels and icons have very little breathing room.

Primary code locations:

- `src/app/arcane-observatory.css:1614-1623` sets a flex row with `flex: 1` navigation items.
- `src/components/ForgeAndFableApp.tsx:2107-2144` renders four labeled items plus brand and user affordances.

Implemented in pass 1: preserve the one-row treatment and 44px-class touch targets while reducing label density and inter-item spacing at 400px and below. A later pass can evaluate an icon-first treatment if populated routes still feel crowded.

### P2 — Roll drawer handle is a very small mobile affordance

The live Dice handle is 28px wide by 112px high at 390px. The drawer body is guarded by a 260px minimum width in `src/components/RollDrawer.tsx:37-63`, which is workable at 320px, but the edge handle is visually easy to miss and awkward to target.

Primary CSS locations: `src/app/globals.css:5904-5951`.

Recommended fix: preserve the drawer’s desktop resize behavior, but switch to a full-width bottom sheet or a clearly sized floating trigger under the mobile breakpoint.

### P2 — Responsive rules are distributed across a large, layered global stylesheet

The active surface is governed by legacy rules in `globals.css`, theme overrides in `arcane-observatory.css`, and repeated late-stage DM/table overrides. Breakpoints include 480, 600, 620, 640, 700, 720, 760, 768, 800, 820, 860, 900, 960, 980, 1024, 1100, 1180, 1220, 1280, and 1320px ranges across the two stylesheets.

This is not itself a defect, but it increases cascade risk: a component can be responsive in the legacy layer and regress when a theme block reintroduces minimum widths. The DM Table evidence is an example of that class of failure.

Recommended fix: make each major surface own one responsive section, remove duplicate breakpoint rules as surfaces are touched, and add a small set of named viewport contracts rather than adding more one-off media queries.

## Surface matrix

| Surface | Live baseline | Initial result | Next verification |
|---|---|---|---|
| Home dashboard | 390/320px | No page-level horizontal overflow; shell is vertically heavy | Verify populated campaign, heroes, quick actions, and activity cards |
| Forge start | 390px | Fits; same shared-shell cost; small Import/New controls | Exercise Standard, Quickbuilder, Premade flows at 320/390px |
| Character builder | Static CSS plus existing 380px screenshots | Responsive rules exist for rail, document, and preview; full live flow still needs a clean isolated pass | Complete every step, modal, choice grid, and sticky preview |
| Hero sheet | Empty state at 390px | Fits in empty state | Verify populated sheet, tabs, editable controls, drag/reorder, and console |
| DM Table | 320/360/390/430px in clean DM session | No page-level horizontal overflow; one-column grid fits at all four widths; mode rail is intentionally scrollable inside the column | Verify populated party, inspector, and all modes |
| Roll drawer | Trigger visible at 390/320px | Handle is small; open/resized state still needs a focused pass | Verify open, history, initiative, resize, keyboard, and narrow-height behavior |
| Modals | Static CSS only | Several breakpoint rules exist | Verify feedback, import, snapshots, level-up, portrait picker, and DM prep |

## Validation baseline

- `npm test`: 37 test files, 264 tests passed.
- `npm run build`: passed on Next.js 16.2.9.
- `npm run typecheck`: passed after the production build regenerated `.next` route types. The first standalone run hit a stale generated-type reference for `src/app/api/campaigns/[id]/members/[userId]/route.js`.
- `npm run lint:ci`: failed on three existing `@next/next/no-img-element` warnings in `DMTablePanel.tsx`, `dmTable/PartyRail.tsx`, and `portraits/CharacterPortrait.tsx`.
- Post-change live shell check: 390px and 320px both reported page `scrollWidth === clientWidth`; the compact home header measured 62px high, with 40px square action buttons.
- Post-change live DM Table check: 390px and 320px both reported page `scrollWidth === clientWidth`; the grid resolved to 366px and 281px single columns respectively. The temporary audit campaign and account were removed after verification.
- Extended live route check: DM Table measured clean at 360px (336px content/grid column) and 430px (406px content/grid column); Forge start and Hero empty states also reported page `scrollWidth === clientWidth` at both widths. The only contained overflow was the intentional 360px mode rail.
- The temporary audit campaign and account were removed after verification; existing campaign data was not modified.
- No repeatable Playwright/Cypress responsive harness was found. The repository contains manual mobile screenshots under `docs/round-6-screenshots/`.

## Recommended implementation batches

1. Extend the DM Table verification with a populated party, inspector, and all four modes.
2. Verify the compact shared mobile shell across all four primary routes and populated states.
3. Run the complete character-builder flow at 320/390px, including class/species modals and the persistent preview.
4. Run the populated Hero sheet and Roll Drawer interaction audit.
5. Exercise every modal and add a small automated viewport smoke suite so regressions become visible in CI.
