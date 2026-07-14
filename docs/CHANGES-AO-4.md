# CHANGES-AO-4 — Arcane Observatory Phase 4 amendment: ink interiors

Date: 2026-07-14. Author: Fable.

## Owner amendment (supersedes part of the plan)

At Gate 3 review of the Phase 3 shell, the owner ruled: **parchment is
retired entirely** — interiors build on the ink-blue palette. This
supersedes the implementation plan's "parchment/ivory for documents" rule
and proposal 34's containment framing. "Document" remains a semantic role:
a distinct, slightly warmer ink panel with ruled lines, not paper.

## What changed (all in src/app/arcane-observatory.css, Phase 4 block)

Mechanism: the paper interiors derive every color from two variable
families, so two scoped re-points flip all of them coherently —

1. **Doc palette** (`--paper`, `--paper-raised`, `--ink`, `--ink-2/-3`,
   `--doc-rule(-soft)`, `--doc-accent(-deep)`, `--doc-select`) re-pointed
   at `.cs-sheet`, `.paper-surface`, `.campaign-panel`, `.feedback-modal`:
   document ink `#152438`/`#1c2e46`, warm-white ink text, seal-red accent,
   old-gold selection.
2. **Ledger "daylight" palette** (`--ledger-*`, R18) re-pointed at the
   theme scope: flips `.ledger-page` surfaces — start panel, onboarding,
   quickbuilder, learn modals, admin. Seal brightened to `#c47b72` for
   small-text contrast on dark.

Also: `--surface-document(-muted)` and `--text-document(-muted)` tokens
updated to ink values; `.ao-document` primitive gets light ruled lines and
a gold spine; showcase copy updated.

**Character skins keep working.** Skins apply these same variables inline,
and inline wins — verified live: an unskinned character renders the new
ink default; a character with the Frozen Tundra preset renders Tundra.
Only the DEFAULT presentation changed. The `data-bg` texture patterns
(grain/linen/stars/…) are var-driven and adapt automatically.

LevelUpModal needed nothing — it already runs on the dark-side tokens.

## Behavior preserved

No TSX changes at all this round (CSS + showcase copy only). All flows
unchanged; skins/share codes untouched; no gameplay/persistence/API
changes.

## Verification

- `npm run build` ✓ · `npm test` 264 ✓ · `npm run lint` 0 errors ✓.
- Recaptured: default sheet (ink) + skinned sheet (Tundra wins), commission
  picker default/chosen, onboarding, quickbuilder, campaigns, mobile.
- Not yet exercised: level-up modal, dice overlay, import/feedback modals,
  DM table in the new interiors — next capture round; DM table has its own
  `--dm-*` scope and is expected to be visually unchanged until 4D.

## Rollback

Revert the AO-4 commit (Phase 4 block + token values + showcase copy).
