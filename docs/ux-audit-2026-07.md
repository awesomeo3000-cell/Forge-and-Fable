# Forge & Fable — UX/UI Audit (2026-07-17)

Full walkthrough of the logged-in app + auth, desktop (1440×900) and mobile
(390×844). Screenshots: `QA/screenshots/ux-audit/`; rerun the capture with
`QA/tests/ux-audit-walk.mjs`. Zero console errors across the walk.

Severity: **P1** = broken or clearly off-palette; **P2** = noticeable rough
edge; **P3** = polish / subjective. Confidence that it's a real defect (not a
taste call) noted per item.

---

## P1 — clear defects

### 0. `lint:ci` is currently red (pre-existing, blocks CI)
`src/components/NotificationInbox.tsx:20` trips the newly-enabled
`react-hooks/set-state-in-effect` rule (`useEffect(() => { void load(); }, [])`
mount fetch). Introduced by commit `e288593` ("polish"), not this audit —
found during it. `npm run lint:ci` (`--max-warnings=0`) fails, so the deploy
lint gate is broken. The prior fix for this rule (AO-16 `homeRefreshKey`) was
to derive instead of set-state-in-effect, but a mount fetch can't be derived —
this one needs a cancel-guarded effect or a justified disable, which is an
owner lint-policy call. **Left for the owner** rather than folded into an
unrelated commit. Build and the 395 tests are green regardless.


### 1. "First look" tour card is Forge-red, not brass  ✅ fixed this pass
`.cs-tour-card` (hero sheet, top) renders a coral left-border + wash from
`--accent: #b2452f` — the retired Forge-fire red. The Observatory palette
re-points doc tokens on `.campaign-panel`/`.feedback-modal` and `--accent`
on `.level-rite-modal`, but never re-points `--accent` for the sheet, so the
card leaks the legacy root value. Every other sheet accent is old gold, so
the red reads as a mistake. Desktop + mobile. **High confidence.**
Fix: AO-scoped `.cs-tour-card` → brass border/wash.

### 2. Campaigns empty state leaves a full-height void  ✅ fixed
`.campaign-page` now centres the panel (flex column, `justify-content:
center`) and the panel bounds its own height (`max-height: calc(100dvh -
62px - 92px)`, internal list scroll), so short/empty states sit centred
instead of stranding dead space, and tall content still scrolls without
clipping.

### 3. Campaigns empty state has no primary action
"New Campaign" and "Join a Campaign" are equal-weight dark buttons. For an
empty roster the DM path ("New Campaign") is the obvious primary and should
carry the brass CTA weight (matches the dashboard's one-primary grammar).
**High confidence.** Safe one-class change.

---

## P2 — noticeable rough edges

### 4. Top-right header cluster is crowded  ◑ partial (chevron muted)
CAMPAIGNS (boxed) + MENU (hamburger + a slightly detached chevron) + bell +
logout sit tightly against the user-id string. Muted/tightened the MENU
caret so it subordinates to the label; the broader spacing/id treatment was
left alone to avoid churning the many header media-query overrides.

### 5. Dashboard right column strands a large gap  — left (empty-state only)
Empty-account dashboard: "Next Session" + "Needs Attention" fill only the top
of the right rail. This balances out once the account has a session/heroes,
so it's an empty-state-only imbalance; left as-is rather than restructure the
owner-approved AO-16 dashboard.

### 6. Action-card artwork is too dark/muddy  ✅ fixed
Idle art was `brightness(0.62)`; the scenes read as near-black. Raised idle to
`saturate(0.92) brightness(0.72)` and re-stepped primary/hover/selected
(0.8/0.84/0.9) so scenes register while the bottom/left copy scrim still
carries text contrast and selection stays the brightest.

### 7. Sheet abilities Adv/Dis toggle is heavy  ✅ fixed
Now a compact inline control: a small "Next roll" label + short "Adv"/"Dis"
toggles (full names kept in `aria-label`/tooltip) that sit on one line in the
narrow abilities column instead of two wrapped full-width pills.

---

## P3 — polish / subjective

### 8. Auth backdrop composition
Desktop: the wayhouse art is cottage-left by composition, so the right third
is dark (a wash also darkens it) — the form floats over empty dark on wide
screens. Mobile: the hero art barely reads (near-flat dark). Not broken, but
the entry screen feels emptier than the art warrants. Consider a centered
composition or a subtle right-side vignette treatment.

### 9. Dice-tray tab uses brass for selection
The DICE/COMBAT tab selection is brass-filled; the app's grammar reserves
brass for the primary action (the Roll button) and uses blue for selection.
Minor internal inconsistency carried over from the pre-redesign tray.

### 10. Campaign heading crossed-swords icon in seal-red
`.campaign-header h2 svg` uses `--doc-accent` (seal red #a84f49). This is an
intentional token role, but a red glyph next to otherwise-gold chrome is
debatable; noting for a taste call, not fixing.

---

## Suggested order
Fix 1 now (done). Then 3 (primary button) and 6 (card art scrim) are quick,
safe wins. 2, 4, 5 are layout decisions worth a quick direction check before
touching. 7, 8, 9, 10 are polish to batch later.
