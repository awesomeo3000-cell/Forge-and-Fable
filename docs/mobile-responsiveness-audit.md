# Forge & Fable mobile responsiveness audit

Date: 2026-07-14
Status: baseline audit complete; P0/P1 remediation pass 1 implemented

## Scope and method

This first pass covered the shared application shell, home dashboard, Forge start surface, Hero empty state, live DM Table, character-builder CSS, character-sheet CSS, roll drawer, campaign/feedback/import modal rules, and the responsive media-query cascade.

Evidence came from:

- Static inspection of `src/components/ForgeAndFableApp.tsx`, `src/components/DMTablePanel.tsx`, `src/components/RollDrawer.tsx`, `src/app/globals.css`, and `src/app/arcane-observatory.css`.
- Live browser checks at 390x844 and 320x844 against the existing local app session. No campaign, character, or rehearsal data was changed.
- Repository validation: 264 tests passed, production build passed, and typecheck passed after the build regenerated Next route types.

## Executive result

The home, Forge start, and Hero empty states fit within the viewport without page-level horizontal overflow. The live DM Table does not yet meet a usable mobile bar: its internal scroll area is 794px wide at a 390px viewport, with the encounter stage and action controls positioned outside the visible 375px content area. The shared mobile shell also spends 270px of an 844px viewport on navigation and the top bar before the main work surface begins.

## P0/P1 remediation pass 1

Implemented in `src/app/arcane-observatory.css`:

- P0 DM Table: reasserts the one-column mobile grid in the final Observatory cascade, including the higher-specificity encounter layout; removes child minimum-width pressure; constrains the encounter, stage, party, inspector, soundboard, and action surfaces to the available column; and allows the Table header controls to wrap.
- P1 shared shell: changes the narrow Observatory masthead to a compact flex row, hides the repeated account label, keeps the action buttons at 40px square targets, and preserves the existing rail visual language.
- P1 320px navigation: keeps the four primary actions in a 44px-class touch target row while reducing only the label density and inter-item spacing needed at the smallest audited width.

Live verification after the change confirmed the shared shell at 390px and 320px: the home top bar is 62px tall instead of 206px, the page remains exactly the viewport width, the three action buttons are 40px square, and the 320px primary navigation items remain 52px wide by 46px high. The current browser session is a player view, so the DM-only Table surface still needs a direct post-change live pass with a DM session.

## Prioritized findings

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

Recommended fix: create a dedicated mobile header layout with a compact title row, a single overflow/menu action, and a separate bottom sheet or menu for secondary actions. Keep the current Observatory visual language.

### P1 — 320px navigation is technically fitting but too compressed

At 320px, the four primary navigation items are approximately 49px wide each. They remain in one row beside the brand and account button, so labels and icons have very little breathing room.

Primary code locations:

- `src/app/arcane-observatory.css:1614-1623` sets a flex row with `flex: 1` navigation items.
- `src/components/ForgeAndFableApp.tsx:2107-2144` renders four labeled items plus brand and user affordances.

Recommended fix: use a compact icon-first bottom/navigation treatment at very narrow widths, or collapse the labels into an explicit menu while retaining accessible names and a 44px-class touch target.

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
| DM Table | 390/320px with rehearsal party | P0 mobile width contract implemented; direct DM-session verification still pending | Verify scene, encounter, prep, review, inspector, soundboard |
| Roll drawer | Trigger visible at 390/320px | Handle is small; open/resized state still needs a focused pass | Verify open, history, initiative, resize, keyboard, and narrow-height behavior |
| Modals | Static CSS only | Several breakpoint rules exist | Verify feedback, import, snapshots, level-up, portrait picker, and DM prep |

## Validation baseline

- `npm test`: 37 test files, 264 tests passed.
- `npm run build`: passed on Next.js 16.2.9.
- `npm run typecheck`: passed after the production build regenerated `.next` route types. The first standalone run hit a stale generated-type reference for `src/app/api/campaigns/[id]/members/[userId]/route.js`.
- `npm run lint:ci`: failed on three existing `@next/next/no-img-element` warnings in `DMTablePanel.tsx`, `dmTable/PartyRail.tsx`, and `portraits/CharacterPortrait.tsx`.
- Post-change live shell check: 390px and 320px both reported page `scrollWidth === clientWidth`; the compact home header measured 62px high, with 40px square action buttons.
- No repeatable Playwright/Cypress responsive harness was found. The repository contains manual mobile screenshots under `docs/round-6-screenshots/`.

## Recommended implementation batches

1. Fix the DM Table mobile width contract and verify at 320, 360, 390, and 430px.
2. Refactor the shared mobile shell/header and verify all four primary routes.
3. Run the complete character-builder flow at 320/390px, including class/species modals and the persistent preview.
4. Run the populated Hero sheet and Roll Drawer interaction audit.
5. Exercise every modal and add a small automated viewport smoke suite so regressions become visible in CI.
