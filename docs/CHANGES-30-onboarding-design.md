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

## Verification
- `npm run build` clean; `npm test` 144/144; `npm run typecheck` clean;
  `npm run lint:ci` 0 warnings.
- Browser login wedges in this environment (standing issue). Verified by
  injecting the real markup into the running app and reading computed styles:
  paper `rgb(233,223,200)`, two-column card grid, header `::after` hairline
  (double rule), seal circle seal-red + 50% radius, choice name small-caps
  weight 600, and **zero elements at font-weight ≥700** (the old block's main
  flaw). Owner: sign up fresh (or clear characters) to see the first-run fork.
