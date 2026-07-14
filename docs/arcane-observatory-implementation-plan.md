# Forge & Fable: Arcane Observatory Redesign Implementation Plan

## Purpose

Implement the approved Arcane Observatory visual direction across Forge & Fable without rewriting or destabilizing the gameplay engine, persistence layer, rules logic, routing, APIs or existing user data.

The redesign must preserve working behavior while replacing the current parchment-everywhere presentation with a layered visual system built around matte ink-blue surfaces, engraved scholarly details, antique brass accents and parchment used only where content should feel like a physical document.

## Visual reference

Primary prototype:

`forge_fable_arcane_observatory_matte_mockup/index.html`

Treat the prototype as a visual north star, not production code. Recreate its hierarchy, material language and page composition using the repository's real components and data.

The production implementation must lean further toward **matte, engraved and scholarly** than the prototype where necessary.

Explicitly avoid:

- glassmorphism
- translucent floating cards
- `backdrop-filter` blur
- glossy gradients
- neon edge lighting
- glowing star fields
- perspective constellations
- hyperspace-like motion
- excessive rounded rectangles
- decorative effects that obscure hierarchy
- generic AI-dashboard styling

## Approved art direction

### Core materials

- Application shell: deep matte midnight blue
- Primary work surfaces: opaque ink-blue and slate panels
- Structural accents: aged brass, blackened iron and engraved rules
- Documents: warm parchment or ivory only for sheets, handouts, notes and archival records
- Active state: seal red
- Selection and focus: arcane blue
- Success and ready states: restrained verdigris green
- Text: warm white on dark surfaces, dark ink on document surfaces

### Core mood

The product should feel like a fortified scholar's observatory used to study dangerous magical knowledge. It should not feel like a spaceship, holographic command center or glass dashboard.

### Visual hierarchy

1. Current action and urgent state
2. Primary task for the current screen
3. Selected object or character
4. Supporting tools and navigation
5. Decorative world-building detail

Decoration must never compete with gameplay state.

---

# Agent Operating Contract

The implementing agent must follow these rules throughout the redesign.

## Protect the engine

Do not alter gameplay behavior unless a phase explicitly requires a small presentation adapter.

Do not change:

- combat math
- initiative ordering logic
- rules resolution
- character progression
- spell logic
- campaign or session persistence
- database schema
- API response shapes
- authentication
- permission logic
- import and export behavior
- autosave behavior
- encounter event semantics

If a visual requirement appears to require an engine change, stop and document the dependency before editing it.

## Work in isolated phases

Complete one phase at a time. Each phase must end with:

- a build that compiles
- existing tests passing
- a visual review summary
- a list of files changed
- screenshots at required breakpoints
- a short regression checklist
- a rollback point or clean commit

Do not combine broad visual refactoring with unrelated feature work.

## Inspect before editing

Before changing code, identify:

- framework and version
- routing structure
- state management approach
- styling system
- shared layout components
- shared input and button components
- current design tokens
- hardcoded colors and spacing
- inline styles
- components that mix gameplay logic with presentation
- responsive breakpoints
- existing automated tests
- existing screenshot or browser test tooling

Do not assume component names from this plan match the repository.

## Prefer adapters over rewrites

When old components contain both behavior and presentation:

1. preserve the behavior
2. extract a presentational wrapper or view component
3. pass the existing data and callbacks into the new view
4. verify parity
5. remove the old visual layer only after parity is proven

## Keep a migration ledger

Create and maintain:

`docs/design/arcane-observatory-migration.md`

For every migrated screen or component, record:

- old component or route
- new component or token dependency
- behavior preserved
- known visual difference
- test coverage
- remaining legacy styles
- rollback commit

---

# Phase 0: Repository Audit and Baseline

## Goal

Understand the current presentation architecture and establish a regression baseline before any visual work begins.

## Tasks

1. Create a dedicated branch such as:
   `feature/arcane-observatory-redesign`
2. Run the current application locally.
3. Record the exact commands required for install, development, build and test.
4. Capture full-page screenshots of all major routes at:
   - 1440 x 900
   - 1280 x 800
   - 768 x 1024
   - 390 x 844
5. Capture the following interaction states where applicable:
   - empty state
   - populated state
   - selected item
   - active combatant
   - modal open
   - dropdown open
   - validation error
   - loading state
   - disabled state
6. Build a route and component inventory.
7. Search the codebase for:
   - parchment color values
   - direct hex values
   - `background` declarations
   - `box-shadow`
   - `border-radius`
   - `backdrop-filter`
   - inline styles
   - theme-specific class names
8. Identify high-risk components where gameplay state and CSS are tightly coupled.
9. Confirm whether visual regression tooling already exists.
10. Create baseline browser tests for the highest-risk flows if none exist.

## Required deliverable

A written audit containing:

- current architecture
- design debt map
- page inventory
- shared component inventory
- risk ranking
- recommended migration order
- list of unknowns

## Stop condition

Do not start Phase 1 until the audit is complete and the project builds successfully from a clean install.

---

# Phase 1: Semantic Design Token Foundation

## Goal

Create a theme layer that can support the new visual system without embedding art-direction names into every component.

## Principle

Components should request a semantic role, not a material by name.

Use:

```css
background: var(--surface-panel);
```

Avoid:

```css
background: var(--dark-blue-parchment-replacement);
```

## Token categories

Create tokens for:

### Surfaces

- `--surface-app`
- `--surface-shell`
- `--surface-panel`
- `--surface-panel-raised`
- `--surface-panel-recessed`
- `--surface-document`
- `--surface-document-muted`
- `--surface-input`
- `--surface-overlay`

### Text

- `--text-primary`
- `--text-secondary`
- `--text-muted`
- `--text-disabled`
- `--text-document`
- `--text-on-accent`

### Borders and rules

- `--border-subtle`
- `--border-default`
- `--border-strong`
- `--border-brass`
- `--rule-engraved`

### State

- `--state-active`
- `--state-active-soft`
- `--state-selected`
- `--state-selected-soft`
- `--state-success`
- `--state-warning`
- `--state-danger`
- `--state-disabled`

### Depth

- `--shadow-panel`
- `--shadow-overlay`
- `--shadow-document`
- `--inset-recessed`

### Geometry

Use a restrained radius system:

- `--radius-xs`
- `--radius-sm`
- `--radius-md`

Avoid a large universal radius. Panels should generally be 2 to 6 pixels. Circular tokens, portraits and seals remain round.

### Spacing

Define a consistent scale such as:

- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40
- 48

### Typography

Map existing project fonts to roles rather than using decorative type everywhere:

- display and major headings
- section headings
- UI labels
- body copy
- numeric and compact statistics

The design must remain readable at game-table viewing distance.

## Suggested starting palette

These are starting values only. Adjust through browser review.

```css
[data-theme="arcane-observatory"] {
  --surface-app: #070d16;
  --surface-shell: #0d1724;
  --surface-panel: #142235;
  --surface-panel-raised: #1a2b40;
  --surface-panel-recessed: #0f1b2a;
  --surface-document: #e5dccb;
  --surface-document-muted: #d3c7b3;
  --surface-input: #101c2b;
  --surface-overlay: #0a111c;

  --text-primary: #edf1f4;
  --text-secondary: #b8c2cc;
  --text-muted: #8391a0;
  --text-disabled: #5f6a75;
  --text-document: #222a34;
  --text-on-accent: #081018;

  --border-subtle: rgba(176, 193, 207, 0.12);
  --border-default: rgba(176, 193, 207, 0.22);
  --border-strong: rgba(176, 193, 207, 0.34);
  --border-brass: #9e8452;

  --state-active: #a84f49;
  --state-active-soft: rgba(168, 79, 73, 0.16);
  --state-selected: #5c94c8;
  --state-selected-soft: rgba(92, 148, 200, 0.16);
  --state-success: #6e9d82;
  --state-warning: #bd9654;
  --state-danger: #bb5b5b;
}
```

## Implementation requirements

- Introduce the theme behind one root attribute or provider.
- Keep the existing theme available during migration if practical.
- Do not replace every color globally before components have been tested.
- Add a development-only theme switcher if it helps side-by-side review.
- Add a token showcase route or Storybook page.

## Acceptance criteria

- No gameplay behavior changes.
- Tokens compile and are documented.
- New components can be built without hardcoded colors.
- Existing screens still render under the legacy theme.
- No `backdrop-filter` is introduced.

---

# Phase 2: Shared Interface Primitives

## Goal

Build the small reusable parts required to migrate the site consistently.

## Required primitives

### Layout

- application shell
- global navigation
- top toolbar
- page heading
- split pane
- inspector rail
- responsive drawer
- mobile bottom navigation

### Surfaces

- matte panel
- raised panel
- recessed panel
- document surface
- engraved section divider
- brass rule

### Controls

- primary button
- secondary button
- quiet button
- destructive button
- icon button
- segmented control
- tab list
- select
- text input
- text area
- checkbox
- radio group
- slider if used
- menu
- tooltip
- modal
- drawer

### Data display

- stat block
- status chip
- active-state marker
- selection marker
- portrait plate
- token disc
- progress or resource meter
- empty state
- notification banner
- event-log entry

## State grammar

The state system established during the DM-screen design must become a reusable component rule.

### Acting now

- visible text label where space allows
- 3-pixel rule
- filled pointer or seal marker
- warm wash
- seal-red accent

### Selected

- selection is confirmed by the open inspector or selected control
- 1-pixel rule where needed
- hollow ring marker
- no background wash by default
- arcane-blue accent

### Combined state

When an item is selected and acting now:

- active styling wins in lists and rails
- selection remains evident through the open inspector
- do not stack red and blue rules
- do not stack two markers

### Accessibility

State must never rely on color alone. Use text, shape, weight, iconography or position as additional cues.

## Material rules

- Panels are opaque.
- Shadows are broad and restrained.
- Borders provide most separation.
- Brass is used for structure and important emphasis, not every border.
- Parchment appears only inside document components.
- Engraved motifs use low contrast and remain flat to the surface.
- Decorative motifs must have `aria-hidden="true"`.

## Acceptance criteria

- Every primitive has hover, focus, active, disabled and error states where applicable.
- Keyboard focus is always visible.
- Controls meet WCAG AA contrast.
- Components are usable at 200 percent zoom.
- No component depends on a star-field background to look complete.

---

# Phase 3: Global Shell Migration

## Goal

Change the site's overall visual identity before deeply redesigning individual pages.

## Scope

- application background
- global navigation
- top navigation or command bar
- account controls
- route transitions
- loading shell
- modal shell
- toast system
- global empty and error pages

## Design requirements

### Background

Use a flat or lightly textured matte field. If texture is used, it should resemble:

- painted wood grain
- slate grain
- fine vellum fibers
- engraved grid lines

Do not use a field of glowing stars.

### Navigation

Navigation should feel mounted into the application frame rather than floating over it.

Use:

- opaque surfaces
- engraved separators
- restrained brass for active section markers
- clear labels
- strong keyboard state

### Decorative celestial language

Allowed:

- flat astrolabe arcs
- compass rings
- lunar phase marks
- inked orbital diagrams
- small alchemical notation

Not allowed:

- perspective star tunnels
- animated particle travel
- lens flares
- glowing nebula clouds
- moving constellations behind content

## Acceptance criteria

- All routes remain reachable.
- Authentication and account actions behave exactly as before.
- Global shell works on desktop, tablet and mobile.
- No content is obscured at 200 percent zoom.
- Existing deep links remain valid.

---

# Phase 4: Page Migration Sequence

Migrate representative pages in the order below. Do not redesign every page at once.

## Phase 4A: Campaign Dashboard

### Purpose

Prove that the new system works for overview, navigation and mixed information density.

### Required treatment

- campaign identity header with restrained engraved motif
- clear next-session or active-session focal area
- party overview
- recent activity
- campaign tools
- document previews that use parchment only inside the preview
- strong empty states

### Behavior preservation

- campaign selection
- session launch
- invitation or player management
- recent activity links
- create and archive actions

### Acceptance criteria

- primary campaign action is obvious within two seconds
- dashboard does not resemble a collection of equal cards
- no more than two visual emphasis levels compete at once

## Phase 4B: Character Creation

### Purpose

Prove that the theme supports a guided workflow and image-heavy selection.

### Required treatment

- clear progress navigation
- portrait selector with large preview
- choices grouped by decision, not boxed indiscriminately
- selected option shown through shape, label and border
- contextual explanation area
- document-like summary only at final review

### Behavior preservation

- every current step
- validation
- back and next behavior
- saved draft behavior
- portrait assignment
- race, class, background and ability selections

### Accessibility

- portrait options require accessible names even if player-facing labels are visually hidden
- selection must be keyboard operable
- errors must be associated with fields

## Phase 4C: Player Character Sheet

### Purpose

Prove that parchment can remain valuable when it is used intentionally.

### Required treatment

- dark application frame
- warm document surface for the actual sheet
- tabs and utility controls remain dark-shell UI
- portrait and identity area feel substantial
- stats read quickly from a distance
- inventory, spells and features should not all become identical cards

### Behavior preservation

- resource changes
- rest actions
- inventory
- spell preparation and casting
- conditions
- notes
- tab state
- import and export

### Acceptance criteria

- users can clearly distinguish game controls from character-sheet content
- parchment is contained and does not flood the entire viewport
- critical stats remain legible at 125 and 150 percent zoom

## Phase 4D: DM Encounter Screen

### Purpose

Transform the most spreadsheet-like live-play screen into an engaging command surface.

### Structural direction

- initiative becomes supporting navigation
- current turn becomes the central operating stage
- selected-character inspector remains separate
- live ledger supports recent history
- soundboard becomes a compact dock

### Initiative requirements

#### Eight or fewer combatants

- standard rows
- portrait or token disc
- initiative value
- name
- HP state
- reaction state
- conditions

#### Nine or more combatants

- compact rows activate automatically
- portraits drop out
- initiative marker and kind glyph remain
- padding tightens
- identical names receive styled index badges

Do not use Unicode circled-number characters for enemy indexes. Use styled numeric badges with accessible labels.

### Active-turn stage

Show:

- acting combatant identity
- meaningful portrait, token or creature glyph
- HP and AC
- conditions
- reaction status
- turn-specific actions
- Ready and Delay controls
- recent relevant events
- dominant Next Turn action

Inactive rows should not repeat a complete control set.

### Encounter log

- newest first
- maximum height around one third of the viewport
- internal scroll
- no forced auto-scroll behavior
- encounter-scoped during an active run
- Show Earlier link for prior session activity
- grouped request responses
- announcements styled as marginalia
- critical events use seal tint
- maximum 40 visible entries
- link to full review beyond the cap

### Sound dock

Keep only:

- now playing
- play or stop
- volume
- two or three pinned cues
- expand or manage action

Move track management to Tools.

### Acceptance criteria

- active turn is identifiable without relying on color
- a 16-combatant seeded encounter remains usable
- combat behavior is unchanged
- Next Turn remains fast and obvious
- keyboard navigation follows visual order
- private DM information does not leak into player-visible feeds

## Phase 4E: Chronicle, Notes, Handouts and Session Review

### Purpose

Use the document side of the visual system where it makes sense.

### Required treatment

- dark shell around document content
- paper surfaces for readable long-form material
- clear distinction between editable notes and published handouts
- chronological review can use a ledger-like rhythm without making the entire app parchment
- filters remain application controls, not printed-document elements

### Behavior preservation

- search
- filters
- editing
- sharing
- visibility permissions
- handout presentation
- export

## Phase 4F: Mobile Experience

### Purpose

Prove the redesign is not a desktop skin.

### Required screens

- campaign overview
- character sheet or companion
- DM encounter control view if supported on mobile
- navigation drawer or bottom navigation
- modal and form examples

### Requirements

- minimum 44 by 44 pixel touch targets
- no horizontal page scroll
- safe-area support
- important actions reachable without precision tapping
- document surfaces use full width where appropriate
- inspectors become drawers or stacked sections
- combat lists remain readable in compact mode

---

# Phase 5: Legacy Style Removal

## Goal

Remove old presentation code only after all migrated surfaces are verified.

## Tasks

1. Identify unused legacy CSS and component variants.
2. Remove duplicate tokens.
3. Remove parchment-specific class names from general-purpose components.
4. Remove obsolete layout wrappers.
5. Remove theme shims that are no longer needed.
6. Confirm no orphaned selectors remain.
7. Run bundle analysis if available.
8. Confirm production build size has not increased unexpectedly.

## Guardrail

Do not delete legacy styles simply because search results show no direct class use. Confirm dynamic class construction and third-party integrations first.

---

# Testing Strategy

## Functional regression

At minimum, test:

- sign in and sign out
- campaign creation and selection
- character creation
- character edits and save
- resource updates
- initiative setup
- initiative advancement
- conditions
- reactions
- rolls and roll requests
- encounter start and end
- encounter log
- handout visibility
- notes save
- mobile navigation

## Visual regression

Capture each migrated page at:

- 1440 x 900
- 1280 x 800
- 1024 x 768
- 768 x 1024
- 390 x 844

Capture meaningful variants, not only default state.

Required DM variants:

- no encounter
- four combatants
- active player turn
- active enemy turn
- selected non-active combatant
- 16 combatants
- conditions present
- encounter log near cap
- sound dock expanded

## Accessibility

Run automated checks and manual keyboard review.

Verify:

- WCAG AA text contrast
- non-color state differentiation
- visible focus
- logical heading order
- landmarks
- accessible control names
- modal focus trapping
- Escape behavior
- reduced-motion handling
- 200 percent zoom
- screen reader announcement for active-turn changes
- touch target size

## Performance

- Avoid continuous decorative animation.
- Lazy-load large portraits and artwork.
- Do not use full-screen blur filters.
- Avoid large fixed background images on mobile.
- Confirm no avoidable rerenders were introduced by theme context.
- Measure DM screen performance with a 16-combatant encounter.

---

# Agent Review Gates

The agent must pause for human review after each gate.

## Gate 1: Audit

Review:

- architecture findings
- risk map
- migration order
- baseline screenshots

## Gate 2: Tokens and primitives

Review:

- color and material balance
- border radius
- panel depth
- state grammar
- controls
- document surface

## Gate 3: Global shell and dashboard

Review:

- whether the site still feels too sci-fi
- whether any glass effects remain
- whether the new shell feels substantial
- whether hierarchy is clear

## Gate 4: Character creation and sheet

Review:

- portrait workflow
- form density
- parchment containment
- readability

## Gate 5: DM encounter screen

Review:

- emotional engagement
- active-turn prominence
- combat density
- large encounter behavior
- log usefulness

## Gate 6: Remaining pages and mobile

Review:

- consistency across modes
- mobile usability
- legacy-theme remnants

The agent must not proceed past a gate based only on its own judgment when a visual review is required.

---

# Commit and Branch Strategy

Use small, reversible commits.

Suggested sequence:

1. `audit: document current visual architecture`
2. `theme: add arcane observatory semantic tokens`
3. `ui: add matte panel and document primitives`
4. `ui: migrate global shell`
5. `ui: migrate campaign dashboard`
6. `ui: migrate character creation`
7. `ui: migrate character sheet`
8. `ui: migrate dm encounter layout`
9. `ui: add encounter ledger presentation`
10. `ui: migrate chronicle and handouts`
11. `ui: complete mobile layouts`
12. `cleanup: remove legacy ledger theme styles`
13. `test: complete visual and accessibility regression coverage`

Do not use one giant redesign commit.

---

# Definition of Done

The redesign is complete only when all of the following are true:

- all existing major workflows still function
- no database migration was required for presentation alone
- no engine behavior changed unintentionally
- all major pages use semantic tokens
- general application surfaces are no longer parchment colored
- parchment is reserved for document-like content
- no glassmorphism remains
- no hyperspace or perspective constellation treatment remains
- active and selected states work without color
- desktop, tablet and mobile layouts are verified
- keyboard navigation is complete
- automated accessibility checks pass at the agreed threshold
- seeded large-encounter testing passes
- old theme styles are removed or deliberately retained with documentation
- production build succeeds
- a human has approved every visual review gate

---

# Master Prompt for the Implementing Agent

Copy the following into the agent that will perform the work.

## Prompt

You are implementing the Forge & Fable Arcane Observatory redesign in an existing working application.

Your highest priority is preserving all existing game behavior. This is a visual-system and interface migration, not an engine rewrite.

Read this implementation plan in full before editing code. Then inspect the repository and produce a Phase 0 audit. Do not begin visual changes until the audit is complete.

Use the supplied Arcane Observatory matte HTML prototype as the visual reference, but do not paste its monolithic HTML or CSS into production. Rebuild the design through the repository's real layouts, components and data flows.

The intended art direction is matte, engraved and scholarly. It should feel like a fortified arcane observatory. It must not feel like a spaceship, glass dashboard or AI-generated concept interface.

Never introduce:

- `backdrop-filter`
- transparent glass cards
- neon glow
- hyperspace star fields
- perspective constellations
- glossy gradients
- decorative animation that distracts from gameplay

Preserve:

- gameplay rules
- state models
- persistence
- routes
- APIs
- permissions
- imports and exports
- autosave
- current user data

Work in phases. At the end of every phase, provide:

1. files changed
2. behavior preserved
3. tests run
4. screenshots at required breakpoints
5. known issues
6. rollback point
7. recommendation for the next phase

Stop for human visual approval at each review gate. Do not claim a screen is complete based only on code review.

Begin with Phase 0 only.
