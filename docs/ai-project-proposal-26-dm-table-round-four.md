# Proposal 26 — DM Table Round Four: focal hierarchy (A1) and encounter log (A2)

Author: Fable (lead design), 2026-07-13. Approved by owner with amendments;
all amendments are folded in below — this document is the implementation
contract. Two rounds, shipped and verified SEPARATELY: A1 then A2. Do not
combine them into one build/changelog.

Conventions (non-negotiable):
- Changelog per round: CHANGES-DM-11 (A1), CHANGES-DM-12 (A2). No entry = not done.
- `npm run build`, `npm test`, `npm run lint` green before a round is called done.
- All new DM Table CSS uses `--dm-ink / --dm-surface / --dm-accent /
  --dm-rule / --dm-muted` and the semantic status tokens. NEVER `--paper`,
  `--ground-2`, or `--ink` — those exist in `.dm-table` scope only as a
  legacy remap (see the comment block at the top of the second `.dm-table`
  rule in `src/app/globals.css`, ~line 12630). No inline token overrides on
  the `.dm-table` element; the only inline custom property there is
  `--doc-accent`.
- Ledger language: hairlines, not boxes. Two font weights, no ≥700 except
  where already established. Color is semantic. Ornament comes from
  artifacts (rules, marks, seals), not decoration.

## Landmines (read before editing)

1. `.dm-command-member`'s main button is styled via
   `.dm-command-member>button:first-child`. Inserting ANY element before it
   silently unstyles the button into the UA's dark ButtonFace (the gray-slab
   incident, CHANGES-DM-10). The sigil `<img>` intentionally renders after
   the buttons in PartyRail.tsx — keep it that way, or migrate the era
   selectors to a class in the same change.
2. globals.css has three DM Table CSS eras layered by cascade order
   (24f dark-desk ~10891+, DM-1/2 ~12420+, the `--dm-*` override layer
   ~12644+, Round Two/Three appends at end of file). Append new rules at the
   end of the file in a labeled block; do not reorder old blocks.
3. Some source lines are minified single-line JSX/CSS; the request-center
   render in DMTablePanel.tsx is wrapped in an IIFE (`{(() => { ... })()}`).
   Edit with exact-match care; the file may contain mixed CRLF/LF regions.
4. `DmWorkspaceMode` lives in `src/lib/dmTable/party.ts`. The view-preset
   system was deleted in CHANGES-DM-8 — do not reintroduce it.

---

# Round Four A1 — initiative row hierarchy, state grammar, adaptive density

Honest scope statement: A1 touches THREE presentation surfaces —
`src/components/DMTablePanel.tsx` (initiative rows),
`src/components/dmTable/PartyRail.tsx` (cards),
`src/components/dmTable/CharacterInspector.tsx` (header) — plus shared CSS.
To keep that tractable, A1 MUST introduce one shared combatant-state
primitive and use it in all three places.

## A1.1 The state marker primitive

One markup contract, used everywhere a member/combatant can be "acting" or
"selected":

```tsx
<span className="dm-state-marker" data-state="acting" aria-hidden="true" />
<span className="dm-state-marker" data-state="selected" aria-hidden="true" />
```

CSS (one block, applied by container rules):

| Cue        | data-state="acting"            | data-state="selected"          |
|------------|--------------------------------|--------------------------------|
| Label      | small-caps "ACTING NOW" (rendered by the container, `font: var(--font-label)`) | none |
| Left rule  | 3px solid on the container     | 1px solid on the container     |
| Marker     | filled triangular pointer      | hollow ring (border, no fill)  |
| Background | container wash: `color-mix(in srgb, var(--dm-accent) 7%, transparent)` | none |
| Color      | `var(--dm-accent)` (seal red)  | `var(--dm-magic)` (blue)       |

Non-color redundancy is the requirement, not a nicety: in grayscale,
labeled + thick + filled must still beat unlabeled + thin + hollow.

## A1.2 Combined state (acting AND selected — this will be common)

- Acting-now styling takes visual priority in the initiative list and the
  party rail. Wherever the red acting treatment is present, the blue
  selection styling is SUPPRESSED — never two left rules, two markers, or
  competing backgrounds on one row/card.
- Selection remains communicated by the open inspector itself.
- The inspector header carries both: its normal selected context plus an
  "ACTING NOW" label when its character holds the turn.
- Implementation note: the container class logic must make the suppression
  structural (e.g. `.is-acting` removes/overrides `.is-selected` treatment
  in CSS), not dependent on callers remembering to not add both.

Replace the existing scattered treatments with the primitive:
- Initiative rows: current `.dm-combatant.is-current` accent rule/wash
  (from CHANGES-DM-10) is superseded by the acting treatment + label.
- Party rail: `.dm-command-member.is-current::before` ("CURRENT" text) and
  `.is-selected` blue rule/wash are superseded by the primitive pair with
  the suppression rule.
- Inspector: header gains the acting label when applicable.

## A1.3 Initiative row redesign (rows, not boxed cards)

Row anatomy, left to right:
1. Die-pip disc: the initiative number in a small bordered disc (click =
   existing hide/reveal behavior, keep `title` and aria-label).
2. Identity disc (standard density only): 36px portrait for player
   combatants (reuse `CharacterPortrait`/`cportrait` primitives; member
   lookup by `memberUserId`); NPC/enemy uses `npc.portraitUrl` when the
   combatant came from an NPC, else the kind glyph (⚔ ✦ ● ○) as an inked
   token in the same disc size.
3. Name block: name, then condition/turn-state chips (existing components).
4. Stats: HP input + AC in ink-weight tabular numerals (keep CHANGES-DM-10
   emphasis).
5. Actions (see A1.5).

Rhythm comes from hairline separators, consistent vertical padding, and the
identity discs — NOT from boxing each row. Duplicate names get styled
numeric badges: a `<sup class="dm-dup-badge">2</sup>`-style element — real
digits, NOT Unicode circled characters (①), for font/AT reliability.
Badge is assigned by order of appearance among identical visible names.

## A1.4 Adaptive density + the existing Compact control

The toolbar already has a Compact button (`compactRail` state, currently
rail-only). Two meanings of "compact" are not acceptable. The rule:

- The Compact button becomes GLOBAL compact presentation: rail cards AND
  initiative rows, at any combatant count. (State/localStorage key
  `forge-and-fable-dm-compact` stays; rename the state variable from
  `compactRail` to `compactTable` for honesty.)
- 9+ combatants in the initiative list automatically renders initiative
  rows compact, regardless of the button. Auto-compacting does NOT toggle
  or visually activate the Compact button — the button reflects only the
  user's own choice.
- Compact initiative rows: identity disc hidden, die-pip + kind glyph kept,
  padding tightened, chips single-line with overflow count (+N).
- Enemy GROUPING (Goblin ×4 as one row) is OUT OF SCOPE — it changes the
  combatant state model. Note it in the changelog as deliberately deferred.

## A1.5 Row actions — the overflow split

Applying frequency / urgency / reversibility / state-visibility:

- Always visible on every row:
  - Reaction: rendered as a STATE CHIP that is a real `<button>` with
    `aria-pressed` (ready/used) — proper interactive semantics, not a chip
    that secretly behaves like a button.
  - Turn (jump to this combatant).
- Visible ONLY on the acting row (context-sensitive — these are actions a
  combatant takes on their own turn): Ready, Delay.
- Overflow menu (⋯, a `<details>` dropdown consistent with existing
  patterns; keyboard accessible) on every row: initiative ↑ / ↓, reroll
  (non-players), duplicate (non-players), Ready/Delay (non-acting rows),
  and Remove — destructive lives behind the deliberate second click, with
  its existing behavior unchanged.
- The 6-option visibility select stays as-is (non-players).
- Condition handling stays in the command row + inspector. Untouched.

## A1.6 Verification (A1)

- Build + tests + lint green. Update/extend any affected tests.
- Seed a 16-combatant encounter (rehearsal party + 12 added enemies incl.
  duplicate names) and verify: auto-compact triggers, badges render,
  acting/selected grammar reads correctly in BOTH densities, overflow menu
  operates by keyboard, reaction chip toggles with aria-pressed.
- Grayscale check: screenshot the encounter view, desaturate it, confirm
  acting vs selected is still unambiguous.
- The preview harness wedges at the app login (known environmental issue) —
  verify with computed-style assertions and owner screenshots, and say so
  in the changelog.

---

# Round Four A2 — the encounter log (separate round, separate build)

The center region's lower half is dead space. Fill it with the session's
ledger being written in real time. The data ALREADY EXISTS: DMTablePanel's
`records` memo (merged campaign.rolls + events) currently renders only in
Review mode. A2 is presentation + filtering; no new server work.

Rules (fixed — do not improvise):
1. Placement: below the initiative list in Encounter mode. Max height ~32vh,
   internal scroll. Newest first; the top is always current, no auto-scroll
   management. Review mode remains the full chronological record.
2. Scope: while an encounter run is active, show records with
   `at >= activeEncounter.startedAt`; a "Show earlier" link lifts the
   filter. No active encounter → session scope. The log survives
   mode/encounter changes (it is a view over the persistent feed).
3. Grouping: rolls that answer one request collapse into a single entry —
   "<request descriptor> — N responded: totals…" — expandable
   (`<details>`) to individual rolls. Group by request via
   `summarizeRollRequest` label + time window; do not invent new server
   linkage.
4. Voice: announcements render as italic marginalia; mechanical events
   plain; death-save and critical-HP events carry a seal tint
   (`var(--dm-danger)` family). Ghost entries carry the existing italic
   *rehearsal* mark.
5. Filter: reuse the existing all / rolls / table filter (same state as
   Review mode is acceptable).
6. Cap: 40 visible entries, then a "Session review" link that switches
   workspace mode.
7. Privacy: the feed contains only what players already broadcast, plus
   ghost rolls (DM-only by construction). Do not add new data to it.

Verification (A2): build/tests/lint; drive a rehearsal encounter (requests,
conditions, announcement, rest) and confirm grouping, scoping, voice
separation, and the 40-entry cap; changelog CHANGES-DM-12.

---

# Explicitly OUT of scope for both rounds

- Enemy grouping in initiative (state-model change; future proposal).
- Inspector folio, party-card hover/state polish, command toolbar intent
  tiering (Round Four B — separate approval).
- Soundboard dock (separate spec; see proposal-25 addendum when written).
- Server follow-ups (withdraw endpoint, ghost initiative filter, loot
  unassign): docs/ai-project-proposal-25-dm-server-followups.md.
- Any change to roll-request payloads, projections, or the rehearsal
  auto-responder.

# File map

- `src/components/DMTablePanel.tsx` — initiative rows (render block around
  the `.dm-initiative` map), Compact state rename, A2 log under the
  initiative list, acting-label logic.
- `src/components/dmTable/PartyRail.tsx` — replace is-current/is-selected
  treatments with the state primitive; keep the sigil-after-buttons order.
- `src/components/dmTable/CharacterInspector.tsx` — header acting label.
- `src/app/globals.css` — one appended block per round, labeled
  `/* -- DM-11 ... -- */` and `/* -- DM-12 ... -- */`.
- Tests: `tests/` — extend where behavior is asserted (reaction toggle,
  density threshold logic if extracted as a pure helper — extracting
  `initiativeDensity(count, userCompact)` into `src/lib/dmTable/` with a
  unit test is encouraged).
