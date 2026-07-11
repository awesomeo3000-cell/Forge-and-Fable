# CHANGES-30 — first-run onboarding design pass (reviewer)

The owner's new post-signup fork ("Create a character" / "Create a campaign")
worked but was styled in the pre-ledger idiom — rounded 10px cards, dashed
borders, font-weight 700/650 everywhere (against the two-weight system),
boxed inputs, generic muted grays. Brought into the ledger world.

## What changed
- `OnboardingPanel.tsx`: now a `ledger-page` with the same masthead as the
  character start screen — "THE LEDGER OPENS" eyebrow + title + the registry
  double rule. The two choices are seal-marked cards (rotated seal circle with
  the icon, small-caps name, italic descriptor, an accent "Begin the
  commission ⟶" / "Take the DM's chair ⟶" that fades in on hover). The
  campaign-name step uses a large ledger hairline-bottom input, a † footnote
  ("you'll get a join code to share"), and ledger buttons; Enter submits.
  Copy warmed to the house voice ("Run a campaign", "Open the table").
- `globals.css` onboarding block rewritten (~138 lines) in the ledger material:
  paper page, seal circles, hairline input, two-weight type, seal-red accent,
  responsive 2→1 column at 640px.

## Follow-up: "small box in a big brown box"
The paper card was shrink-wrapped and floating high on the dark studio surface,
which still showed its `--desk` brown background + border behind it (because
`onboarding-panel` lacked the `dj-start` class the transparency rule keyed on).
Fixed:
- Added `.onboarding-panel` to `studio-surface:has(...)` → surface goes
  transparent/borderless behind it (verified: surface bg + border both
  `rgba(0,0,0,0)`), same as the character-start and builder pages.
- The panel now fills the surface (`min-height: calc(100dvh - 102px)`) and
  centers its content vertically — no dark void below (verified: panel 618px
  of 618 available, `justify-content: center`).
- Cards given real presence: `min-height` up to 340px (measured 302px at
  720p), 72px seals, 19px titles. It reads as a full parchment page with two
  substantial choices, not a small card in a box.

## Follow-up: pictorial cards (owner request)
The two choices now use the builder's threshold-card treatment — full-bleed
ink-washed art + bottom scrim + caption. Two named files drop into
`public/Start/`:
- `onboard-character.jpg` — an outline/silhouette of a hero.
- `onboard-campaign.jpg` — two hands working puppeteer control bars (the DM).
Graceful two-state design (`OnboardingPanel`): each card starts in a
seal-icon fallback (centered dark-ink caption on parchment) and flips to
art-mode on image load (seal hidden, art+scrim at full opacity, caption
anchored bottom-left in paper-light ink). Verified both states by computed
style: fallback seal `display:grid` + ink `rgb(42,32,24)` centered; art-mode
seal `display:none`, scrim/art opacity 1, name `rgb(236,225,201)`, content
`align-content:end`. Cards ~374px tall. Ships polished with zero art;
lights up when the files land.

## Verification
- `npm run build` clean; `npm test` 144/144; `npm run typecheck` clean;
  `npm run lint:ci` 0 warnings.
- Browser login wedges in this environment (standing issue). Verified by
  injecting the real markup into the running app and reading computed styles:
  paper `rgb(233,223,200)`, two-column card grid, header `::after` hairline
  (double rule), seal circle seal-red + 50% radius, choice name small-caps
  weight 600, and **zero elements at font-weight ≥700** (the old block's main
  flaw). Owner: sign up fresh (or clear characters) to see the first-run fork.
