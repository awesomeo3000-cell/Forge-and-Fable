# Forge & Fable Arcane Observatory UI Integration Plan

## Status

Approved direction for implementation planning.

This document converts the Arcane Observatory browser mockup into a production implementation plan for the existing Forge & Fable project. It is written for an agentic coding system working inside the real repository.

The project already has the approved color palette in place. The agent must use the production palette and semantic tokens already present in the repository. The mockup is the source of truth for composition, hierarchy, material treatment and interaction framing. It is not the source of truth for exact color values or production code.

## Visual references

Primary structural reference:

`forge_fable_arcane_observatory_matte_mockup/index.html`

Palette reference:

`forge_fable_arcane_blue_palette_options/index.html`

Earlier implementation planning reference:

`forge-fable-arcane-observatory-implementation-plan.md`

Copy these files into a repository documentation folder such as:

```text
docs/design/arcane-observatory/reference/
```

Do not import the mockup HTML or CSS into the application. Rebuild the design with the project's real components, data, routes and state management.

---

# 1. Approved Product Decisions

These decisions are settled unless a technical audit proves one is incompatible with the existing application.

## 1.1 Global art direction

The new interface uses the Arcane Observatory direction:

- deep matte arcane-blue application shell
- opaque slate and ink-blue work surfaces
- restrained accent color from the production palette
- warm document surfaces only where content should feel like a sheet, handout, journal or archival record
- engraved scholarly decoration rather than glowing magical effects
- strong information hierarchy for active play
- minimal decorative motion

The interface should feel like a fortified observatory, scholar's workshop and game table. It should not feel like a spaceship, neon dashboard, holographic interface or glassmorphism template.

## 1.2 Palette

The production palette already implemented in the repository is the source of truth.

The agent must:

1. locate the current semantic token definitions
2. confirm which token is the primary arcane blue
3. confirm which token replaced the earlier brass accent
4. reuse those tokens throughout the redesign
5. avoid introducing slightly different duplicate shades in page-level CSS
6. document any contrast adjustment required for accessibility

Do not revert to the brass palette shown in an older mockup.

## 1.3 Dashboard

The campaign dashboard shown in the matte mockup is approved as the primary direction.

Preserve the key ideas:

- current campaign receives the dominant visual treatment
- resume or open-session action is obvious
- next-session information is visible without opening another page
- recent activity is readable as a timeline or ledger
- campaign status, party summary and preparation state are visible at a glance
- secondary tools remain available without competing with the main task

## 1.4 Forge character creator

The character creator shown in the matte mockup is approved as the primary direction.

Preserve the key ideas:

- clear multi-step progress navigation
- main editing surface with calm form density
- live character preview or summary on the right at desktop widths
- portrait selection treated as a visual choice rather than a labeled demographic filter
- strong separation between identity, mechanics and review
- persistent progress and save behavior

## 1.5 Character sheet

The fully modular and customizable character sheet already built in the project remains the product direction.

Do not replace it with the fixed three-column sheet shown in the prototype.

The redesign may change:

- application shell around the sheet
- character identity header
- portrait presentation
- character name presentation
- hit point presentation
- armor class, speed and other primary vital presentation
- module chrome
- edit-mode controls
- tabs, drawers and utility controls
- mobile stacking behavior

The redesign must preserve:

- module configuration
- drag and drop behavior
- resizing
- add and remove module behavior
- saved layouts
- per-character customization
- module visibility rules
- resource editing
- all character mechanics

## 1.6 Table

The Table shown in the matte mockup is approved as the primary direction.

Preserve the key ideas:

- initiative is supporting navigation rather than the whole screen
- the current turn receives the central visual focus
- the selected combatant inspector remains separate from the acting-turn stage
- recent session activity appears in a live Ledger region
- repeated controls are removed from inactive initiative rows
- the soundboard becomes a compact dock
- active state remains distinguishable without relying on color alone

---

# 2. Non-Negotiable Engineering Guardrails

## 2.1 Protect the engine

This is a presentation migration with selective layout refactoring. It is not an engine rewrite.

Do not change unless a separately approved task requires it:

- combat calculations
- initiative ordering logic
- turn advancement semantics
- character progression rules
- spell rules
- condition rules
- resource calculations
- campaign persistence
- session persistence
- database schema
- API response shapes
- authentication
- permissions
- import or export behavior
- autosave behavior
- character sheet layout data format
- module IDs
- saved module configuration

When a visual requirement appears to require an engine change, stop. Document the dependency, explain why a presentation adapter cannot solve it and wait for approval.

## 2.2 Preserve working component contracts

Prefer adapters and presentation wrappers over behavioral rewrites.

When a component mixes logic and styling:

1. identify its behavioral contract
2. preserve props, callbacks and state ownership
3. extract a presentational component where practical
4. pass the existing data into the new component
5. verify parity before removing old markup

## 2.3 No monolithic mockup transplant

Do not paste the browser prototype into a single production component.

The production version must use reusable primitives, real application data and the existing component architecture.

## 2.4 Feature flag the migration

Create a temporary theme or feature flag so old and new interfaces can be compared during migration.

Recommended forms:

```text
uiTheme: "ledger" | "observatory"
```

or

```text
FEATURE_ARCANE_OBSERVATORY=true
```

The exact mechanism must fit the existing project.

Do not delete the old presentation until all critical routes have passed functional and visual review.

## 2.5 Small reversible commits

Each implementation phase must be independently reviewable and reversible.

Avoid one large redesign commit.

---

# 3. Required Phase 0 Audit

The agent must complete this audit before changing visual code.

## 3.1 Repository inventory

Identify and document:

- framework and version
- build tooling
- routing system
- state management
- styling system
- existing token files
- current theme mechanism
- icon system
- font loading
- image handling
- component library
- test tooling
- screenshot tooling
- browser automation tooling
- responsive breakpoints

## 3.2 Route inventory

List every user-facing route and classify it as:

- global shell
- dashboard
- campaign management
- character creation
- character sheet
- Table or DM controls
- Chronicle or session review
- handout or document surface
- settings
- authentication
- utility or admin

## 3.3 Shared component inventory

Locate existing components for:

- buttons
- inputs
- select controls
- tabs
- dialogs
- drawers
- tooltips
- cards or panels
- page headers
- portrait display
- HP controls
- status chips
- initiative rows
- inspector panels
- character sheet modules
- drag handles
- sound controls
- activity feed

For each component, record:

- file path
- current visual role
- behavior it owns
- whether it can be restyled safely
- whether behavior and presentation are coupled
- migration risk

## 3.4 Character sheet audit

This is required before any sheet work.

Document:

- module registry
- module component contract
- grid or canvas library
- layout serialization format
- drag and resize implementation
- edit-mode state
- play-mode state
- responsive layout behavior
- how module titles and controls are rendered
- how identity, portrait and HP are currently rendered
- whether identity is itself a module
- saved layout compatibility risks

The agent must explicitly state how the new identity masthead can be added without invalidating existing saved layouts.

## 3.5 Table audit

Document:

- encounter state owner
- initiative list data shape
- current combatant state
- selected combatant state
- player and NPC portrait data
- reaction state
- condition state
- roll request state
- event or activity feed data
- soundboard state
- inspector data flow
- player-visible versus DM-only data

## 3.6 Baseline screenshots

Capture the current site at:

- 1440 x 900
- 1280 x 800
- 1024 x 768
- 768 x 1024
- 390 x 844

Capture meaningful states, including:

- dashboard with campaign data
- character creator first step
- character creator portrait step
- character creator review step
- character sheet default layout
- character sheet heavily customized layout
- character sheet edit mode
- Table with four combatants
- Table with sixteen combatants
- active player turn
- active enemy turn
- selected non-active combatant
- Chronicle or review with populated data
- modal and drawer states

## 3.7 Audit deliverable

Create:

`docs/design/arcane-observatory/audit.md`

It must include:

- architecture summary
- component map
- route map
- token map
- risk map
- migration order
- saved-data risks
- test gaps
- unresolved questions

Stop after the audit and request approval before beginning Phase 1.

---

# 4. Visual System Requirements

## 4.1 Semantic tokens

Use semantic roles rather than material-specific names.

Recommended categories:

```css
/* Application surfaces */
--surface-app;
--surface-shell;
--surface-panel;
--surface-panel-raised;
--surface-panel-recessed;
--surface-control;
--surface-control-hover;
--surface-control-active;
--surface-document;
--surface-document-raised;

/* Text */
--text-primary;
--text-secondary;
--text-muted;
--text-disabled;
--text-on-accent;
--text-document;
--text-document-muted;

/* Structure */
--border-subtle;
--border-default;
--border-strong;
--border-focus;
--shadow-panel;
--shadow-overlay;

/* State */
--state-selected;
--state-active;
--state-ready;
--state-warning;
--state-danger;
--state-disabled;

/* Spacing and shape */
--space-1 through --space-8;
--radius-control;
--radius-panel;
--radius-overlay;
--control-height-sm;
--control-height-md;
--control-height-lg;
```

Map these semantic tokens to the approved production palette.

Do not add page-specific hex values unless the value is truly unique and documented.

## 4.2 Material rules

### Application surfaces

Use opaque matte surfaces.

Allowed:

- subtle tonal changes
- low-contrast engraved rules
- restrained shadows
- one-pixel borders
- occasional inset line for structure

Disallowed:

- `backdrop-filter`
- translucent glass cards
- frosted panels
- strong blur
- glossy highlights
- neon outer glows
- luminous cyan edges
- large perspective star fields

### Document surfaces

Warm paper is allowed for:

- handouts
- journals
- character notes
- Chronicle entries
- printed-style rules references
- export previews

Warm paper should not be used for:

- global navigation
- toolbars
- soundboard controls
- initiative controls
- page backgrounds
- modal shells
- campaign navigation

## 4.3 Celestial and arcane decoration

Use decoration as flat scholarship, not spatial travel.

Approved motifs:

- engraved astrolabe rings
- compass marks
- flat star charts
- lunar phases
- alchemical notation
- small orbital diagrams
- map grid fragments
- blackened metal linework

Rules:

- decoration remains low contrast
- decoration never sits behind critical text without a solid reading surface
- decoration does not animate continuously
- decoration does not use perspective streaks
- decoration does not resemble hyperspace

## 4.4 Shape language

Use restrained corners.

- controls may use small radii
- panels may use small to moderate radii
- document surfaces may be nearly square
- avoid pill shapes except tags, filters and compact status indicators
- avoid turning every section into a rounded card

## 4.5 Depth

Depth must come from hierarchy, not transparency.

Recommended order:

1. app background
2. shell or rail
3. standard panel
4. raised active panel
5. modal or drawer

Use shadows sparingly. A border and tonal shift should do most of the work.

## 4.6 State grammar

State must survive grayscale and color-vision differences.

### Acting now

- visible label such as `ACTING NOW`
- heavier left rule or top rule
- filled directional marker
- warm surface wash
- production active-state color

### Selected

- no acting label
- thinner rule
- hollow marker or ring
- selected-state color
- inspector or detail panel confirms selection

### Acting and selected at the same time

- acting-now treatment takes priority in the initiative list and party rail
- selection remains confirmed by the open inspector
- do not stack competing rules or markers

### Focus

Keyboard focus must use a separate visible focus ring. Do not reuse selected or active state as focus.

## 4.7 Typography

Use the project's approved font stack.

Recommended role mapping:

- display and character names: Zilla Slab
- UI labels and body: Roboto
- dense controls and metadata: Roboto Condensed
- optional small caps or navigation accents: Montserrat

Typography must create hierarchy without relying on decorative effects.

## 4.8 Motion

Allowed:

- short hover transitions
- drawer and modal transitions
- controlled collapse and expand motion
- brief active-turn change cue

Disallowed:

- looping stars
- floating particles
- persistent glow pulses
- moving constellation lines
- decorative parallax

Honor `prefers-reduced-motion`.

---

# 5. Shared Production Components

Create or adapt shared primitives before building pages. Use project naming conventions if they differ.

## 5.1 `AppShell`

Responsibilities:

- desktop rail or navigation
- mobile navigation
- global page background
- route title region
- global utilities
- responsive content frame

It must not own page-specific data.

## 5.2 `ObservatoryPanel`

Variants:

- `default`
- `raised`
- `recessed`
- `active`
- `danger`

Props should represent semantic intent rather than direct colors.

## 5.3 `DocumentSurface`

Use for paper-like content only.

Variants may include:

- `sheet`
- `handout`
- `journal`
- `compact`

## 5.4 `PageHeader`

Supports:

- eyebrow or campaign context
- page title
- concise supporting copy
- primary actions
- secondary actions
- optional status tags

## 5.5 `CommandBar`

Use for screen-level tools.

It should support:

- one clear primary action
- grouped secondary actions
- overflow actions
- responsive collapse

Do not render every action with equal visual weight.

## 5.6 `PortraitFrame`

Variants:

- `hero`
- `standard`
- `compact`
- `token`
- `enemyGlyph`

Requirements:

- predictable crop behavior
- fallback initials or glyph
- lazy loading where appropriate
- accessible alt handling
- no gender or identity labels attached to portrait choices

## 5.7 `IdentityBlock`

Displays:

- character name
- player name when relevant
- class and level
- ancestry or species when relevant
- portrait
- status context

It should be reusable in the sheet masthead, inspector and Table stage without forcing identical layout.

## 5.8 `VitalStat`

Use for HP, AC, speed, initiative and other important values.

Variants:

- read-only
- editable
- meter
- compact
- critical

The component must preserve existing update callbacks and validation.

## 5.9 `StatusChip`

Use for conditions, reaction state, readiness, campaign status and filters.

Interactive chips must use button semantics. Read-only chips must not pretend to be buttons.

## 5.10 `ActivityTimeline`

Use for dashboard activity and live Ledger presentation.

Support:

- timestamp
- event type
- actor
- summary
- expandable details
- privacy flag
- grouped roll responses

## 5.11 `EmptyState`

Every major page must have an intentional empty state with:

- concise title
- useful explanation
- one primary action
- optional restrained illustration or engraved motif

## 5.12 Overlay components

Dialogs, drawers, popovers and menus must share:

- opaque surfaces
- consistent border treatment
- visible focus
- correct focus trapping
- Escape behavior
- responsive positioning

---

# 6. Global Shell Implementation

## 6.1 Desktop layout

Build a stable application frame with:

- compact left navigation rail or side navigation
- route-aware active state
- top page context where needed
- central content area
- optional right utility region controlled by each page

The shell should feel substantial and quiet. It should not compete with the content.

## 6.2 Navigation

Recommended core labels:

- Dashboard
- Forge
- Hero
- Table
- Chronicle
- Settings or Tools

Use the project's existing information architecture if labels differ.

Navigation requirements:

- active state is obvious without color alone
- icons are supportive, not required for comprehension
- labels remain available at standard desktop widths
- collapsed navigation has accessible tooltips
- mobile navigation does not reproduce the desktop rail at a tiny size

## 6.3 Responsive shell

At tablet widths:

- reduce rail width or convert to compact rail
- preserve page title and primary action
- move secondary utilities into an overflow menu

At mobile widths:

- use a bottom navigation or drawer based on existing project patterns
- keep primary gameplay actions reachable
- avoid horizontal page scrolling
- account for safe-area insets

## 6.4 Shell acceptance criteria

- all routes render inside the new shell
- no route requires parchment as its page background
- navigation works by keyboard
- active route is announced correctly
- old and new shell can be compared under the feature flag
- no gameplay logic was moved into the shell

---

# 7. Dashboard Implementation

## 7.1 Purpose

The dashboard should answer four questions immediately:

1. Which campaign am I working in?
2. What is happening next?
3. What needs attention?
4. How do I resume play?

## 7.2 Desktop composition

Recommended layout:

```text
Page header

Dominant current-campaign feature        Next-session panel

Campaigns or party summary               Preparation status

Recent activity timeline                 Quick tools
```

The exact grid may adapt to real data and current routes.

## 7.3 Current campaign feature

Include:

- campaign name
- concise campaign description
- session number or current chapter
- party level and party size when available
- resume session or open Table action
- campaign overview action
- restrained campaign art or engraved map treatment if real artwork exists

Do not use a large glowing constellation background.

## 7.4 Next-session panel

Include only data that exists.

Possible fields:

- date and time
- session title
- preparation state
- location or platform
- participant readiness
- quick edit action

## 7.5 Recent activity

Use the shared timeline pattern.

Show a controlled number of recent events with a link to Chronicle.

Do not turn the dashboard into a complete session log.

## 7.6 Campaign cards

Campaign cards should communicate:

- campaign identity
- last activity
- current status
- party count
- next action

Cards must not all have equal visual priority. The active campaign remains dominant.

## 7.7 Dashboard responsive behavior

Tablet:

- current campaign spans full width
- next session moves below or beside based on available space
- supporting cards use two columns

Mobile:

- current campaign summary first
- primary resume action visible without scrolling past secondary content
- next session second
- activity and tools stack below

## 7.8 Dashboard behavior preservation

Preserve:

- campaign selection
- campaign creation
- session resume
- campaign links
- recent activity links
- preparation actions
- permission-based visibility

## 7.9 Dashboard acceptance criteria

- current campaign is identifiable within two seconds
- resume action is the strongest action
- empty states exist for no campaign and no upcoming session
- no data is duplicated only for visual effect
- all existing dashboard actions remain available

---

# 8. Forge Character Creator Implementation

## 8.1 Purpose

Forge should feel guided, visual and deliberate without hiding mechanical depth.

## 8.2 Desktop composition

Recommended three-region structure:

```text
Step navigation | Main editing surface | Live character summary
```

Suggested proportions:

- step rail: 200 to 240 pixels
- main editor: flexible
- summary: 280 to 340 pixels

Use the repository's current steps and data model. Do not invent a new character-creation sequence merely to match the mockup.

## 8.3 Step navigation

Each step should show:

- step number or compact icon
- step name
- complete, current or incomplete state
- validation state when necessary

Requirements:

- current step does not rely on color alone
- completed steps remain revisitable if current behavior allows it
- keyboard navigation follows logical order
- mobile version becomes a progress header or step drawer

## 8.4 Main editing surface

Use grouped sections with clear headings.

Avoid excessive nested cards. Prefer:

- section heading
- concise helper text
- fields aligned by relationship
- subtle dividing rules
- contextual validation

Forms must preserve current bindings, defaults and validation.

## 8.5 Live summary panel

Show only useful current information:

- portrait
- character name
- ancestry or species
- class and level when known
- key ability choices
- background
- unresolved requirements

The summary should update from the existing creation state. Do not create a second source of truth.

## 8.6 Portrait selection

Approved behavior:

- visual grid of portrait choices
- no player-facing labels by sex or gender
- no assumptions about identity
- large selected preview
- selected state visible without color alone
- keyboard selection supported
- fallback when an asset is missing

If race or ancestry categories are used internally to load asset groups, keep those labels out of the player-facing portrait selector unless they are useful and already approved.

## 8.7 Review step

The review step should summarize:

- identity
- class and ancestry
- ability scores
- proficiencies
- equipment
- spells when applicable
- unresolved warnings

The final creation action must remain unambiguous.

## 8.8 Mobile Forge

Mobile requirements:

- one main task per screen
- progress remains visible
- summary becomes a drawer or collapsible panel
- portrait grid uses at least two columns where possible
- touch targets are at least 44 by 44 pixels
- footer actions remain reachable

## 8.9 Forge acceptance criteria

- every current creation path still works
- all saved or resumed creation state still loads
- portrait selection is accessible
- no step loses validation messaging
- summary panel never becomes the source of truth
- form density remains usable at 125 and 150 percent zoom

---

# 9. Modular Character Sheet Implementation

## 9.1 Core principle

The customizable sheet canvas is retained.

The Arcane Observatory redesign should improve the frame around customization and the chrome of each module. It must not turn the sheet into a fixed editorial layout.

## 9.2 Recommended page structure

```text
Global application shell
Character identity masthead
Sheet-level command bar
Customizable module canvas
Optional drawers for inventory, settings or editing tools
```

The identity masthead sits outside the saved module grid unless the current architecture proves this would break expected customization. Keeping it outside the grid protects essential identity and vital information while allowing the rest of the sheet to remain fully modular.

## 9.3 Character identity masthead

Recommended desktop layout:

```text
Portrait | Name and identity | HP control | AC | Speed | Conditions | Sheet actions
```

### Portrait

- 72 to 96 pixels at desktop widths
- use real selected portrait
- clear fallback
- clicking may open portrait or identity editing only if current permissions allow it

### Name and identity

- character name receives the primary typographic emphasis
- player name appears as secondary context where relevant
- class, level and ancestry appear in one concise line
- long names must wrap or truncate gracefully without pushing vitals off screen

### HP

HP should be the strongest editable vital.

Recommended treatment:

- current and maximum HP
- temporary HP when present
- clear damage and healing actions
- visual meter with accessible text
- critical state treatment that does not rely only on color

Do not replace existing HP update logic. The masthead must call the same actions or callbacks already used by the sheet.

### Other vitals

Show the smallest useful set globally:

- AC
- speed
- proficiency bonus or passive perception only if consistently useful
- conditions

Do not duplicate every statistic already available in modules.

## 9.4 Masthead modes

Implement responsive density rather than separate products.

### Full mode

Used at wider desktop widths.

Shows portrait, full identity, full HP control, key vitals, conditions and actions.

### Compact mode

Used on narrower desktop and tablet widths.

Shows smaller portrait, name, class and level, compact HP, AC and conditions. Secondary actions move into overflow.

### Mobile mode

Shows:

- compact portrait
- name
- current and maximum HP
- conditions indicator
- expand control for other vitals

Consider a sticky compact identity bar while scrolling the modular sheet, but verify that it does not consume too much vertical space.

## 9.5 Sheet command bar

Possible actions, based on existing features:

- edit layout
- add module
- reset layout
- import
- export
- rest actions
- settings

Only the most common action should receive primary emphasis. Destructive or rare actions belong in overflow.

## 9.6 Module chrome

Create a shared module frame around existing module content.

A module frame may include:

- module title
- optional icon
- collapse action
- edit or settings action in edit mode
- drag handle in edit mode
- remove action in edit mode
- content region
- optional footer action region

Rules:

- module behavior remains owned by the existing module
- frame controls appear only when relevant
- drag handles are visible and keyboard alternatives are documented
- module backgrounds use opaque panel surfaces
- document-like modules may opt into `DocumentSurface`
- avoid identical card styling for every type of content

## 9.7 Module visual families

Use limited families based on content type.

### Data modules

Examples: ability scores, saves, skills, vitals.

Treatment:

- dense, structured, low decoration
- strong numbers
- subtle rules

### Action modules

Examples: attacks, spells, abilities.

Treatment:

- clearer interactive rows
- state and resource visibility
- buttons grouped by intent

### Collection modules

Examples: inventory, features, spell lists.

Treatment:

- list hierarchy
- search or filters where already supported
- expandable detail

### Document modules

Examples: notes, biography, journal.

Treatment:

- optional warm document surface
- comfortable line length
- editorial typography

## 9.8 Edit mode

Edit mode must be clearly distinct from play mode.

Use:

- explicit `EDITING LAYOUT` label
- stronger canvas boundary
- visible drag handles
- module add tray
- clear save or done action
- undo or reset only if already supported

Do not leave editing handles visible during normal play.

## 9.9 Saved layout compatibility

The agent must test:

- old saved layouts load under new module frames
- module dimensions remain valid
- unknown or deprecated modules fail gracefully
- identity masthead does not shift stored grid coordinates
- mobile fallback does not overwrite desktop layout data unless current behavior already does so

## 9.10 Character sheet acceptance criteria

- modular customization remains fully functional
- old layouts load without migration or with a documented safe adapter
- character identity and HP are easier to read than before
- the sheet does not become a fixed three-column design
- edit mode and play mode are visually distinct
- modules can opt into appropriate visual families
- critical controls remain accessible at 200 percent zoom

---

# 10. Table Implementation

## 10.1 Purpose

The Table should feel like a live DM command surface rather than a spreadsheet.

The visual hierarchy is:

1. what is happening now
2. who acts next
3. who is selected for inspection
4. what just happened
5. supporting tools

## 10.2 Desktop composition

Recommended layout:

```text
Party rail | Initiative navigation + active-turn stage | Inspector
            Live Ledger below the active-turn stage
Sound dock across the bottom or anchored within the shell
```

The exact grid should fit the existing page shell and minimum supported viewport.

## 10.3 Party rail

Show:

- player portrait
- character name
- player name when useful
- HP state
- AC or one additional vital
- conditions
- current-turn and selected states

Avoid decorative watermark art that does not help the card.

Portraits should carry identity. Background ornament should remain minimal.

## 10.4 Initiative navigation

Inactive rows should show only information required to understand order and state.

Standard row fields:

- initiative value
- portrait or token
- name
- HP state
- reaction state
- condition summary

Do not repeat full action menus across every row.

### Adaptive density

Eight or fewer combatants:

- standard rows
- portraits or token discs
- comfortable spacing

Nine or more combatants:

- compact rows activate automatically
- portraits may drop out
- kind glyph remains
- padding tightens
- identical-name enemies use styled numeric index badges

Seed and test a sixteen-combatant encounter.

### Row actions

Always visible:

- jump to turn when permitted
- reaction state

Acting row only:

- Ready
- Delay
- current-turn actions

Overflow:

- initiative nudge
- reroll
- duplicate
- remove
- low-frequency corrective actions

Destructive actions require deliberate confirmation.

## 10.5 Active-turn stage

This is the visual centerpiece.

Show:

- acting combatant portrait, token or creature glyph
- name and type
- initiative position
- current HP and maximum HP
- AC
- reaction state
- conditions
- relevant resources
- Ready and Delay
- recent events tied to that combatant
- dominant Next Turn action

The active stage is an operating surface, not a second character sheet. Keep it focused on the current turn.

## 10.6 Selected inspector

The inspector is for deeper examination and editing.

Recommended header:

- larger portrait
- name
- class or creature type
- player name when relevant
- HP and AC summary
- conditions

Inspector content should use existing tabs or sections for:

- details
- actions
- conditions
- notes
- inventory or abilities when supported

Selection and acting state may refer to the same combatant. Acting state remains visually dominant.

## 10.7 State grammar

Apply the shared active and selected grammar to:

- initiative list
- party rail
- active stage
- inspector header

Do not rely on the accent colors alone.

## 10.8 Live Ledger

Use the existing event and roll data.

Rules:

- newest first
- internal scroll
- height capped around one third of the central viewport
- no forced auto-scroll
- encounter-scoped while an encounter is active
- session-scoped when no encounter is active
- `Show earlier` link for preceding activity
- maximum forty visible entries before linking to full review
- grouped responses for one roll request
- announcements use marginalia styling
- critical events receive active-state emphasis
- private DM events remain private

Example grouped roll entry:

```text
Perception check - 4 responded: 18, 14, 11, 9
```

Expanded state may reveal individual rollers.

## 10.9 Command bar

Group actions by purpose.

Suggested groups:

- communication: announce, handout
- resolution: request roll, condition, loot
- encounter setup: add combatant
- encounter lifecycle: start, pause, end

Do not make every action primary.

The actual primary action must be based on the product's intended workflow and observed use, not an assumption from the prototype.

## 10.10 Sound dock

Compact dock contents:

- now playing
- play or stop
- volume
- two or three pinned cues
- expand or manage action

Move track creation and library management into Tools or an expanded drawer.

Audio must continue across mode changes if that is current behavior.

## 10.11 Table responsive behavior

Tablet:

- inspector becomes a drawer
- party rail may collapse to portraits or move into a drawer
- initiative and active stage remain visible

Mobile, if DM controls are supported:

- active stage first
- initiative in a drawer or tab
- inspector in a separate drawer
- Next Turn remains reachable
- no tiny repeated controls

## 10.12 Table behavior preservation

Preserve:

- encounter creation
- encounter start and end
- initiative order
- turn advancement
- selection
- reaction state
- conditions
- roll requests
- announcements
- handouts
- loot
- combatant add, duplicate and remove
- private versus public event visibility
- audio continuity

## 10.13 Table acceptance criteria

- the acting combatant is obvious within one second
- the screen no longer reads primarily as a spreadsheet
- inactive rows remain compact and informational
- a sixteen-combatant encounter remains usable
- Next Turn remains fast
- selected and acting states work without color
- live Ledger does not become visual sludge
- player-private data does not leak

---

# 11. Chronicle, Notes and Handouts

## 11.1 Chronicle

Use a dark application shell with a readable chronological content region.

Recommended structure:

- page header and filters on dark UI surfaces
- timeline or session list on opaque panels
- selected session details in a document surface where appropriate
- export controls remain standard UI controls

## 11.2 Notes

Differentiate:

- private DM notes
- shared campaign notes
- published handouts

Visibility must be clear through labels and icons, not color alone.

## 11.3 Handouts

Handouts are a strong use case for warm document surfaces.

Support:

- title
- image or illustration
- body copy
- visibility state
- published or draft state
- player preview

The editor shell remains dark and functional. The handout preview may use paper.

## 11.4 Session review

Use the full chronological record with filters and search.

This is where detailed roll history, announcements and encounter events can expand beyond the compact live Ledger.

---

# 12. Settings and Utility Screens

Do not leave utility routes in the old parchment theme.

Migrate:

- settings
- campaign configuration
- audio library
- portrait management
- import and export
- user preferences
- permissions

These should use the same form, panel and command-bar primitives as the main product.

Avoid decorating settings screens with unnecessary celestial art.

---

# 13. Accessibility Requirements

## 13.1 Contrast

Verify WCAG AA contrast for:

- primary text
- muted text
- buttons
- selected states
- active states
- document text
- disabled controls
- focus rings

Do not assume the palette is accessible because it looks good in the mockup.

## 13.2 Keyboard

Verify:

- navigation rail
- dashboard cards and actions
- creator step navigation
- portrait selection
- character sheet edit mode
- module controls
- initiative rows
- command bar
- inspector tabs
- drawers and dialogs
- sound dock

## 13.3 Screen reader behavior

Provide meaningful announcements for:

- character creator step changes
- portrait selection
- HP updates
- active-turn changes
- reaction status changes
- condition changes
- new Ledger entries when appropriate
- layout edit mode

Avoid overly verbose live regions.

## 13.4 Zoom and reflow

Test at:

- 125 percent
- 150 percent
- 200 percent

No critical control may become unreachable.

## 13.5 Touch

Interactive targets should be at least 44 by 44 pixels on touch layouts.

---

# 14. Performance Requirements

- avoid continuous decorative animation
- avoid full-screen blur filters
- lazy-load portraits and campaign artwork
- use responsive image sizes
- avoid remounting engine-owned components during theme changes
- memoize only when profiling supports it
- test Table performance with sixteen combatants
- test modular sheet performance with a dense saved layout
- ensure theme context does not cause avoidable full-app rerenders

Record before and after performance observations for the Table and character sheet.

---

# 15. Testing Plan

## 15.1 Functional regression flows

At minimum automate or manually verify:

### Dashboard

- open current campaign
- create or switch campaign
- resume session
- open next-session details

### Forge

- start character
- move through every step
- select portrait
- validate required fields
- save progress
- resume progress
- create character

### Character sheet

- load old saved layout
- enter edit mode
- add module
- move module
- resize module
- remove module
- save layout
- update HP
- apply condition
- use resource
- rest
- import and export

### Table

- start encounter
- add combatants
- advance turn
- select non-active combatant
- mark reaction used
- Ready and Delay
- request roll
- receive multiple roll responses
- apply condition
- send announcement
- share handout
- end encounter
- verify Ledger scope
- verify sound continuity

### Chronicle and handouts

- search
- filter
- open session
- edit note
- publish handout
- verify player visibility

## 15.2 Visual regression states

Capture at five standard viewports:

- 1440 x 900
- 1280 x 800
- 1024 x 768
- 768 x 1024
- 390 x 844

Required page states:

- dashboard full and empty
- Forge identity step
- Forge portrait step
- Forge validation errors
- modular sheet play mode
- modular sheet edit mode
- modular sheet dense layout
- Table four combatants
- Table sixteen combatants
- active player
- active NPC
- selected non-active combatant
- Ledger near cap
- Chronicle
- handout editor and preview
- mobile navigation

## 15.3 Visual review questions

At each review gate, ask:

- does this still feel too much like a ledger everywhere?
- does any part feel like glassmorphism?
- does any celestial decoration read as sci-fi travel?
- is the primary task obvious?
- is the page visually engaging without becoming noisy?
- are active and selected states understandable without color?
- does parchment appear only where it earns its place?
- does the interface still feel like Forge & Fable?

---

# 16. Implementation Phases

## Phase 0: Audit and baseline

Deliver:

- architecture audit
- route and component map
- baseline screenshots
- risk report
- proposed file-level migration order

Human approval required.

## Phase 1: Tokens, primitives and feature flag

Implement:

- semantic token mapping to existing palette
- new shell primitives
- panel and document primitives
- buttons, inputs, tabs, chips and overlays
- feature flag
- component showcase or internal style route

Human approval required.

## Phase 2: Global shell and dashboard

Implement:

- new application shell
- responsive navigation
- dashboard composition
- dashboard empty states

This phase proves the art direction across a real page before deeper migrations.

Human approval required.

## Phase 3: Forge

Implement:

- step navigation
- form surfaces
- live summary
- portrait selector
- review step
- mobile Forge behavior

Human approval required.

## Phase 4: Modular character sheet frame

Implement:

- identity masthead
- sheet command bar
- shared module frame
- edit-mode treatment
- visual module families
- responsive masthead

Do not alter module data contracts.

Human approval required with old saved layouts loaded.

## Phase 5: Table

Split into controlled subphases.

### Phase 5A: Composition and state hierarchy

- party rail
- initiative navigation
- active-turn stage
- inspector frame
- command bar
- active and selected grammar
- adaptive density

Human approval required.

### Phase 5B: Live Ledger

- event presentation
- grouped roll responses
- filtering
- encounter scope
- caps and links

Human approval required.

### Phase 5C: Sound dock and responsive Table

- compact dock
- audio management relocation
- tablet inspector drawer
- supported mobile behavior

Human approval required.

## Phase 6: Chronicle, notes, handouts and settings

Implement remaining routes with shared primitives.

Human approval required.

## Phase 7: Accessibility, performance and cleanup

- complete keyboard review
- run automated accessibility checks
- profile critical screens
- remove unused legacy styles
- remove feature flag only after approval
- document retained legacy exceptions

Final approval required.

---

# 17. Agent Deliverable Format After Every Phase

The agent must report:

## Summary

What was implemented and why.

## Files changed

List every created, modified and removed file.

## Behavior preserved

List workflows verified unchanged.

## Visual changes

Describe the visible result without vague claims.

## Screenshots

Provide required desktop, tablet and mobile captures.

## Tests

List commands run and results.

## Accessibility review

Report automated results and manual keyboard checks.

## Risks or unresolved issues

State anything incomplete or uncertain.

## Rollback point

Provide the commit hash or branch state that restores the previous phase.

Do not proceed to the next human review gate without approval.

---

# 18. Suggested Commit Sequence

```text
audit: document current UI architecture and baselines
theme: map production palette to semantic observatory tokens
ui: add observatory panel and document primitives
ui: add observatory application shell
ui: migrate campaign dashboard
ui: migrate forge step navigation and forms
ui: migrate forge portrait selection and summary
ui: add character identity masthead
ui: migrate modular sheet module chrome
ui: add modular sheet edit-mode treatment
ui: restructure table initiative and active stage
ui: add table inspector and state grammar
ui: add live ledger presentation
ui: replace soundboard footer with compact dock
ui: migrate chronicle and handouts
ui: migrate settings and utility routes
a11y: complete observatory keyboard and contrast fixes
test: add observatory visual regression coverage
cleanup: remove superseded ledger presentation styles
```

Commit names should match repository conventions when different.

---

# 19. Definition of Done

The redesign is complete only when:

- the production palette is used consistently through semantic tokens
- the dashboard matches the approved hierarchy and mood
- Forge matches the approved guided creator direction
- the character sheet remains fully modular and customizable
- old saved sheet layouts still load
- character name, portrait and HP are clearer in the new masthead
- the Table centers the acting combatant rather than a data grid
- initiative remains usable with sixteen combatants
- the live Ledger is useful and controlled
- the soundboard is a compact dock
- parchment is limited to document-like content
- no glassmorphism remains
- no hyperspace-like constellation treatment remains
- active and selected states work without color alone
- desktop, tablet and mobile layouts are verified
- keyboard navigation is complete
- accessibility checks meet the agreed threshold
- critical workflows pass regression testing
- engine logic and saved data remain intact
- a human approves every review gate

---

# 20. Master Prompt for the Implementing Agent

Copy the following prompt into the coding agent after placing this plan and the visual references in the repository.

## Agent prompt

You are implementing the Forge & Fable Arcane Observatory UI redesign in an existing working application.

Read `docs/design/arcane-observatory/implementation-plan.md` in full before editing code. Also inspect the supplied matte browser prototype. The project already contains the approved production color palette. Use the repository's current palette and semantic tokens as the color source of truth.

The approved structural references are:

- the campaign dashboard from the Arcane Observatory matte prototype
- the Forge character creator from the prototype
- the Table from the prototype

The fixed character sheet shown in the prototype is not the production direction. Preserve the project's fully modular and customizable character sheet. Redesign its application frame, identity masthead, portrait, HP treatment, command bar, module chrome and edit mode without changing saved layout contracts or module behavior.

Your highest priority is preserving all game behavior, data and saved layouts. Do not rewrite the engine, alter API contracts or change persistence for visual convenience.

The intended mood is matte, engraved and scholarly. It should feel like a fortified arcane observatory and game table. It must not feel like a spaceship, neon dashboard, glass interface or generic AI concept UI.

Never introduce:

- `backdrop-filter`
- translucent glass cards
- neon edge glow
- animated star fields
- perspective constellations
- hyperspace streaks
- glossy gradients
- continuous decorative animation

Use warm paper only for actual document-like content such as handouts, journals, notes and archival review.

Begin with Phase 0 only. Inspect the repository and create the required audit, route map, component map, token map, baseline screenshots and risk report. Pay special attention to the modular character sheet data contract and the Table's encounter state.

Do not begin Phase 1 until the audit has been reviewed and approved.

At the end of every phase, report files changed, behavior preserved, tests run, accessibility findings, screenshots, unresolved risks and the rollback point. Stop at every human review gate.

