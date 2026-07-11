# CHANGES-27 — DM-first onboarding and campaign-scoped roles

Implemented from the DM-first onboarding and campaign-scoped roles implementation plan.

## What changed

### Phase 1: Campaign summaries with role data

**`src/lib/campaignStore.ts`**
- `CampaignSummary` type extended with three new fields:
  - `myRole: "dm" | "player"` — derived from `dmUserId === userId`
  - `myCharacterId: string | null` — from the membership row
  - `myCharacterName: string | null` — from a LEFT JOIN on characters
- `listCampaigns` SQL rewritten to JOIN characters for the enrolled character name. The role is computed per-row in the map callback.

**`src/components/CampaignPanel.tsx`**
- Campaign list split into **"CAMPAIGNS I RUN"** and **"CAMPAIGNS I PLAY IN"** sections using `campaign.myRole`.
- Running campaigns show "DM · N members". Playing campaigns show "Playing as <name> · N members".
- Sections only render when they have at least one campaign.

**`src/app/globals.css`**
- New `.campaign-group-heading` class for section labels: label font, tight tracking, muted ink color.

### Phase 2: Neutral first-run onboarding

**`src/components/OnboardingPanel.tsx` (NEW)**
- Replaces the forced `CharacterStartPanel` when the user's vault is empty.
- Four-choice screen:
  1. **Create a Character** — opens the Standard builder
  2. **Run a Campaign** — reveals a name input; creates a campaign with no character and routes directly to the DM Table
  3. **Join a Campaign** — opens the CampaignPanel in list view
  4. **Go to My Ledger** — dismisses onboarding, shows the empty vault + campaign list
- Callbacks: `onStartBuilding`, `onRunCampaign(name) => Promise<boolean>`, `onJoinCampaign`, `onGoToLedger`
- Themed from the active character's skin (paper/ink/accent CSS variables).

**`src/components/ForgeAndFableApp.tsx`**
- New derived state `showOnboarding` (computed from `user`, `characters.length`, `creatorOpen`, `creationPromptOpen`, and an `onboardingDismissed` flag) — avoids the lint-forbidden `setState` in `useEffect` pattern.
- Onboarding panel renders above the CharacterStartPanel in the workspace hierarchy.
- `onRunCampaign` handler: POSTs to `/api/campaigns`, then calls `setActiveCampaign` + `setCampaignOpen(true)` to route directly to the Table.
- `onCreateCharacter` prop wired for the join flow (calls `beginBuild("standard")`).

**`src/app/globals.css`**
- New `.onboarding-panel`, `.onboarding-choices`, `.onboarding-choice`, `.onboarding-form` etc. classes (~100 lines). Parchment/ledger theme: paper-raised cards with accent border on hover, dashed secondary button, text hierarchy (eyebrow → heading → body → muted).

### Phase 3: Join improvements and character eligibility

**`src/components/CampaignPanel.tsx`**
- Added `onCreateCharacter?: () => void` prop.
- Join form: when `characters.length === 0`, shows **"Create a Character"** button instead of the previous muted text "Create one first from the Vault."
- The button calls `onCreateCharacter`, which closes the panel and opens the builder.

**`src/lib/campaignStore.ts`**
- `joinCampaign` now enforces **one character per campaign** server-side:
  ```sql
  SELECT cm.campaign_id, c.name AS campaign_name
  FROM campaign_members cm
  JOIN campaigns c ON c.id = cm.campaign_id
  WHERE cm.character_id = ? AND cm.campaign_id != ?
  ```
- If found, throws: `This character is already enrolled in "<campaign name>". Duplicate the character or choose another one.`

## Verification
- `npm run lint` — 0 errors, 0 warnings
- `npm run build` — clean
- `npm test` — 144/144 tests passed
- TypeScript: `npx tsc --noEmit` — clean

## Key design decisions
- No global `isDm` check introduced. Routing remains per-campaign: `campaignSync?.campaign.dmUserId === user.id`.
- DM membership with `characterId: null` is valid — party strip renders "DM" with no character row. No placeholder character created.
- The onboarding screen uses a derived boolean (`showOnboarding`) with a dismissal flag rather than a `useEffect` + `setState` pattern, keeping the React hooks lint rule satisfied.
- Character eligibility is enforced server-side only in this round. Client-side "Already in a campaign" labeling and "Duplicate for this campaign" action are deferred.

## Files changed
| File | Change |
|---|---|
| `src/lib/campaignStore.ts` | CampaignSummary extended, listCampaigns SQL rewritten, joinCampaign eligibility check |
| `src/components/OnboardingPanel.tsx` | NEW — neutral first-run choice screen |
| `src/components/CampaignPanel.tsx` | Campaign grouping, join flow Create button, onCreateCharacter prop |
| `src/components/ForgeAndFableApp.tsx` | Onboarding wiring, Run Campaign handler, onCreateCharacter callback |
| `src/app/globals.css` | Campaign group headings, onboarding panel CSS |

## Review follow-up

- **Schema revision 6:** added a partial unique index on
  `campaign_members(character_id)` for non-null character IDs. The existing
  preflight check remains for a friendly campaign-name error, while the index
  is the final protection against concurrent joins enrolling one character in
  multiple campaigns. Legacy duplicate assignments are repaired during the
  migration by retaining the newest enrollment and clearing only the stale
  membership's character assignment.
- **Onboarding destinations:** Join now opens directly in the join form, and
  My Ledger opens the campaign list. Stale active-campaign state is cleared for
  both paths.
- **Builder entry:** Create a Character now opens the existing build-mode
  commission page, preserving the Standard, Quickbuilder, and Premade choices
  before entering any individual builder flow.
- **Loading behavior:** character loading is tracked explicitly so first-run
  onboarding does not flash before the vault request resolves. Campaign launch
  displays an opening state until the first campaign sync arrives.
- **Regression coverage:** campaign roles, character metadata, sequential
  enrollment rejection, and database-level enrollment uniqueness are now tested.

The focused review follow-up was verified with 144 passing tests plus clean
lint, typecheck,
and production-build gates after implementation.
