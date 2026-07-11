# CHANGES-28 — DM prep workshop design pass (reviewer)

Follows the CHANGES-27 formatting normalization. The crew had already given
`DMPrepPanel` a paper-surface base, but it diverged from the ledger system in
specific ways; this brings it into strict conformance and delivers the rail
promised in the review.

## Structure
- **Horizontal tabs → left rail.** `DMPrepPanel` JSX restructured: header on
  top, then a `dm-prep-body` grid of `dm-prep-rail` (186px) + `dm-prep-content`
  (status + main). The six sections are now the same rail idiom as the builder
  TOC and the level-up checklist — active tab carries an accent left rule.
  Status moved into the content column. No logic touched (state, handlers, and
  all six tab bodies are byte-identical).

## Material (globals.css `.dm-prep*` block rewritten in place, ~260 lines)
- Paper grain overlay (`::before`, opacity .05) — was absent; now matches the
  Table and every ledger page.
- Registry double rule under the header (2px heavy + 1px hairline `::after`).
- **font-weight 700 eliminated** — every label/heading/summary was 700, against
  the two-weight system (400/500–600). Now 600. Verified: zero elements in the
  panel compute to weight ≥700.
- **Boxed inputs → the ledger input idiom**: transparent background,
  hairline-*bottom* border only (0px top / 1px bottom), seal-red focus — the
  same inputs as the builder and level-up. Checkbox labels kept inline
  (not stacked caps).
- Buttons aligned to the ledger button system: outline default, ink-fill
  primary, small-caps Archivo. Header/close buttons are quiet ink.
- Library rows get an accent left-rule on hover; warnings, empty states, and
  editor summaries all restyled to the ledger voice (ghost italic empties,
  accent open-summary).
- Copy: "CAMPAIGN WORKSHOP" → sentence-case "Campaign workshop" (house voice).
- Responsive: rail folds to a horizontal tab strip under 768px.

## Verification
- `npm run build` clean; `npm test` 129/129; `npm run typecheck` clean;
  `npm run lint:ci` 0 warnings.
- Browser login wedges in this environment (standing issue), so verified by
  injecting the real `.dm-prep` markup into the running app (which carries the
  live tokens + CSS) and reading computed styles:
  - paper `rgb(236,225,201)`, body grid `186px | 1fr` (rail present),
  - active rail button seal-red text + seal-red left border,
  - inputs border `0px top / 1px bottom`, transparent bg,
  - header `2px` rule + `1px` `::after` hairline (double rule),
  - labels weight 600 uppercase, grain `::before` opacity .05,
  - primary button ink-fill `rgb(36,28,18)` on paper text, secondary transparent,
  - warnings `3px` seal-red left rule,
  - **zero elements at font-weight ≥700**.
- Owner: restart the server, open a campaign as DM → Prepare, and confirm the
  rail + hairline forms live (screenshots timed out here — environmental).
