# CHANGES-16b — Campaigns v1 (party play)

Implemented from `docs/ai-project-proposal-16.md` §16b.

## What changed

### Database (`src/lib/db.ts`)
- Added `campaigns`, `campaign_members`, `campaign_rolls` tables to the SQLite schema.
- Campaign rolls capped at 200 per campaign (oldest pruned on insert).
- Index on `campaign_rolls(campaign_id, created_at)` for feed queries.

### Campaign Store (`src/lib/campaignStore.ts` — NEW)
- `createCampaign(userId, name)` — generates 6-char join code (A-Z, 2-9, no 0/O/1/I), auto-joins DM as member.
- `joinCampaign(userId, code, characterId)` — upsert membership, verifies character ownership.
- `listCampaigns(userId)` — returns campaigns the user is a member of, with member counts.
- `getCampaignDetail(campaignId, userId)` — members (with character info), latest 50 rolls, DM gets full character JSON.
- `postRoll(campaignId, userId, charName, label, detail, total)` — inserts roll, enforces 200-roll cap.
- `deleteCampaign(campaignId, userId)` — DM-only.
- `leaveCampaign(campaignId, userId)` — non-DM leave; DM must delete instead.

### API Routes (5 new routes)
| Route | Method | Purpose |
|---|---|---|
| `/api/campaigns` | GET, POST | List campaigns, create campaign |
| `/api/campaigns/join` | POST | Join by code + character |
| `/api/campaigns/[id]` | GET, DELETE | Detail (members + rolls), delete |
| `/api/campaigns/[id]/rolls` | POST | Post a roll to the feed |
| `/api/campaigns/[id]/members/me` | DELETE | Leave campaign |

All routes cookie-authenticated. Non-members get 404 on detail. Roll total capped −999..999, strings capped 80/200 chars.

### Client — CampaignPanel (`src/components/CampaignPanel.tsx` — NEW)
- **List**: shows all campaigns with names, member counts, join codes.
- **Create**: name input → generates code → shows shareable code with copy button.
- **Join**: code input + character picker from the user's vault.
- **Detail**: member list (with View Sheet for DM), live roll feed.
- **Polling**: 5s interval while panel open, pauses on tab hidden (`visibilitychange`).
- **Sheet view**: DM can open a member's character in read-only HeroSheet.
- Theming: dark-chrome idiom (not paper-surface).

### Roll sharing (`ForgeAndFableApp.tsx`)
- `recordHistory` now posts each roll to the active campaign's feed (fire-and-forget, errors silently logged).
- Active campaign tracked in `localStorage` key `forge-and-fable-active-campaign`.
- Campaign button in top bar (between Upload and Feedback).

### Read-only HeroSheet (`HeroSheet.tsx`)
- New `readOnly?: boolean` prop. When true:
  - `data-readonly` attribute on the sheet root.
  - Banner "Viewing <name> (read-only)" at top.
  - Skin/Layout/Reset buttons hidden.
  - CSS blocks pointer events on interactive controls (steppers, toggles, pips, delete buttons, inputs).
  - `onUpdate` used as no-op; tab switching and scrolling still work.

### CSS (`globals.css`)
- `.cs-readonly-banner` — styled info bar.
- `[data-readonly]` rules — disable interactive sub-regions.
- `.campaign-panel` and all child classes (~200 lines) — dark-chrome styled panel.

## Verification status
- `npm run lint`: 0 errors, 0 warnings ✅
- `npm run build`: clean ✅
- API routes registered: `/api/campaigns`, `/api/campaigns/join`, `/api/campaigns/[id]`, `/api/campaigns/[id]/rolls`, `/api/campaigns/[id]/members/me` ✅
- Two-browser test: pending (requires running app with two profiles).

## Not yet done
16c (table extras) — not started.
