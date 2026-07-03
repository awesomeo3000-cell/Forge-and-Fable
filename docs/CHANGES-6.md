# Round 6 - Character Builder Dossier Overhaul

## Scope

Implemented the Round 6 presentation refactor for the character builder. This pass only changes builder/start/quickbuilder markup and CSS presentation. Server routes, ruleset data, sheet behavior, vault storage, skins, and the roll drawer were not changed.

## Rail

- Replaced numbered step tabs with a dossier margin rail in `CreatorPanel`.
- Rail rows are real buttons and keep the existing free step-jump behavior through `props.onStepChange`.
- Step state uses the existing validation gates:
  - Setup: name and at least one source.
  - Class: class selected.
  - Origin: background selected.
  - Species: species selected.
  - Attributes: any stat method is active.
  - Finalize: all prior required choices are present.
- Verified desktop rail states while walking Setup, Class, Origin, Species, Attributes, and Finalize.
- Verified mobile rail at 380px becomes horizontal with no page-width overflow.

Screenshots:
- `docs/round-6-screenshots/01-setup.png`
- `docs/round-6-screenshots/02-class.png`
- `docs/round-6-screenshots/06-finalize.png`
- `docs/round-6-screenshots/13-mobile-setup-380-viewport.png`

## Header

- Removed the old two-column hero preview from the builder.
- Added a persistent document header with:
  - small-caps eyebrow,
  - display-serif character name or dotted `unwritten` placeholder,
  - species / class / origin / alignment slot line.
- Verified header slots filled as choices landed:
  - class changed from empty to Barbarian via card,
  - class changed to Wizard via learn modal,
  - origin filled as Sage,
  - species filled as Tiefling.

Screenshots:
- `docs/round-6-screenshots/02-class-selected-card.png`
- `docs/round-6-screenshots/02-class-selected-modal.png`
- `docs/round-6-screenshots/03-origin-selected.png`
- `docs/round-6-screenshots/04-species-selected.png`

## Cards

- Replaced oversized builder tiles with compact dossier index cards using new `dj-` classes.
- Class and species cards use a 5px identity-color top tab.
- Selection state uses the app accent border and a small `chosen` pill.
- Class cards keep the full-card select target and expose a separate Preview class link.
- Species cards preserve the modal-first selection flow.
- Origin cards use the same compact card pattern with app-accent tabs.

Screenshots:
- `docs/round-6-screenshots/02-class.png`
- `docs/round-6-screenshots/03-origin.png`
- `docs/round-6-screenshots/04-species.png`

## Stamped Rows

- Added selected-item stamped rows for class, origin, and species.
- Rows use paper-raised backgrounds, hairline borders, a left accent bar, compact icon/seal, one-line metadata, and a `chosen` pill.
- Class and species rows use the existing `[data-class]` / `[data-species]` hue variables.

Screenshots:
- `docs/round-6-screenshots/02-class-selected-modal.png`
- `docs/round-6-screenshots/03-origin-selected.png`
- `docs/round-6-screenshots/04-species-selected.png`

## Setup

- Reworked the name input into a document-writing field with a bottom rule only.
- Kept all source/settings logic intact through `SourceSettingsPanel`.
- Tightened paper-surface settings blocks with dossier-scoped radius and spacing overrides.
- Verified Continue remained disabled until both a name and a source were present.

Screenshots:
- `docs/round-6-screenshots/01-setup.png`
- `docs/round-6-screenshots/01-setup-filled.png`

## Attributes

- Added the compact live stat strip at the top of the Attributes section.
- Preserved point buy, standard array, rolled stats, steppers, and assignment controls.
- Verified:
  - Point Buy shows six steppers.
  - Array shows six selectors.
  - Roll shows six selectors and `Roll 4d6`; rolling populated the stat strip.

Screenshots:
- `docs/round-6-screenshots/05-attributes-point-buy.png`
- `docs/round-6-screenshots/05-attributes-array.png`
- `docs/round-6-screenshots/05-attributes-roll.png`

## Finalize

- Restyled the final review as `Seal the record`.
- Kept the original missing-field guard and `props.onCreate` path.
- Verified Forge Hero succeeded and opened the finished sheet.

Screenshots:
- `docs/round-6-screenshots/06-finalize.png`
- `docs/round-6-screenshots/07-finished-sheet.png`

## Start Panel

- Restyled build-mode cards as compact index cards with top tabs.
- Kept the same selected-mode state and Continue behavior.
- Verified Standard, Quickbuilder, and Premade can still be chosen from the start panel.

Screenshots:
- `docs/round-6-screenshots/00-start.png`
- `docs/round-6-screenshots/08-start-after-sheet.png`

## Quickbuilder

- Restyled Quickbuilder into the same dossier/index-card language.
- Kept the existing three-step shortcut flow:
  - fight style,
  - class,
  - species plus name.
- Verified the flow reached final review, then Forge Hero opened the finished sheet.

Screenshots:
- `docs/round-6-screenshots/09-quickbuilder-style.png`
- `docs/round-6-screenshots/09-quickbuilder-class.png`
- `docs/round-6-screenshots/09-quickbuilder-species.png`
- `docs/round-6-screenshots/10-quickbuilder-sheet.png`

## Premade

- Restyled premade archetype choices as dossier cards.
- Kept archetype selection, name entry, final review, and Forge Hero behavior.
- Verified the premade flow forged a finished sheet.

Screenshots:
- `docs/round-6-screenshots/11-premade-archetypes.png`
- `docs/round-6-screenshots/12-premade-review.png`
- `docs/round-6-screenshots/12-premade-sheet.png`

## Legacy CSS Notes

- Added new builder-specific CSS at the end of `src/app/globals.css` under `dj-` selectors.
- Retired the active builder dependency on the old `hero-preview`, `creator-stage`, `choice-tile`, and `build-mode-card` presentation by moving the modified panels to `dj-` classes.
- Left older `.paper-surface` compatibility overrides in place because several are still shared by source settings, learn modals, and other paper surfaces. Removing those safely should be a separate cleanup pass after visual regression checks.

## Verification Click Path

- Registered a disposable local test account.
- Standard flow:
  - Start panel -> Standard -> Continue.
  - Setup: typed `Dossier Hero`, selected `5e Core Rules`, continued.
  - Class: selected Barbarian by card; opened Wizard modal and selected Wizard through modal.
  - Origin: selected Sage.
  - Species: opened Tiefling modal and chose species.
  - Attributes: checked Point Buy, Array, Roll, and `Roll 4d6`.
  - Finalize: clicked Forge Hero and confirmed the sheet opened.
- Quickbuilder:
  - Chose Magic -> Wizard -> Human, named `Quick Dossier`, reviewed, forged, and confirmed the sheet opened.
- Premade:
  - Chose Healer, named `Premade Dossier`, reviewed, forged, and confirmed the sheet opened.
- Responsive:
  - Set viewport to 380px, confirmed horizontal rail and no horizontal overflow.

## Deviations

- Did not delete broad legacy `.paper-surface` override blocks in this round. The new builder no longer relies on the old hero-preview or oversized tile markup, but some overrides still protect shared modal/settings surfaces.
- Did not modify `RollDrawer`. In this local browser session the previously saved drawer-tab position could overlap screenshots; that is existing persisted drawer state, not part of the builder refactor.

## Commands

- `npm run lint` passed with the existing unrelated warnings in `AppearancePanel.tsx` and `skins.ts`.
- `npm run build` passed.
