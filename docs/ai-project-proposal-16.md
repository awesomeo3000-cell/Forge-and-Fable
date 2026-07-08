# Forge & Fable — Round 16: Conditions with teeth + Campaigns v1

**Audience:** strongest available agent, fresh session. This round has two independent halves — do them as two sub-rounds with separate commits (16a, 16b). All design decisions are pre-made below; if the code has drifted from an anchor named here, re-locate it by grep, don't redesign.
**Read first:** `docs/ROADMAP-1.0.md` §0. **Before each half:** checkpoint commit.

---

## 16a — Conditions with teeth (effects-engine extension)

Today the standard conditions (Blinded, Poisoned, etc.) are label-only presets in the effects engine. Give the common ones real mechanics using ONLY existing effect fields plus one new field.

1. **New effect field `advantageMode?: "advantage" | "disadvantage"`** — while such an effect is active, the character's d20 rolls default to that mode (feeding the existing `rollMode` pipeline; an explicit user override in the drawer wins for that one roll, then reverts to the effect's mode instead of "normal"). Type + validation (enum whitelist, copy the `d20Dice` case style) + one integration point where `rollMode` is read.
2. **Exhaustion as a leveled effect:** preset "Exhaustion" gains a level stepper (1–6) in the effects row when active. Data: reuse the effect entry with a new optional `stack?: number` (1–6, validated). Mechanics applied while active, per 2014 RAW: lvl≥1 → `advantageMode: disadvantage` on ability checks ONLY — since our engine's advantageMode is global-d20, the pre-made simplification is: lvl 1–2 → disadvantage on ALL d20s (documented simplification); lvl≥3 nothing further mechanical except a visible label "speed halved / HP max halved etc." in the effect description text (informational). Do not attempt speed/HP-max automation this round.
3. **Rewire the condition presets:** Blinded → `advantageMode: disadvantage` (attack rolls RAW; global here, same documented simplification); Poisoned → `advantageMode: disadvantage`; Restrained → disadvantage + note text; Invisible → `advantageMode: advantage`; Prone/Frightened/Grappled stay label-only with descriptive text. Update `EFFECT_PRESETS` in `src/lib/effects.ts`.
4. Effects section UI: an active effect with `advantageMode` shows a small ADV/DIS chip; the roll drawer's mode control shows "(from effects)" hint when an effect is driving it.

Accept: toggle Poisoned → next d20 roll from the sheet rolls 2d20-keep-lower automatically (verify in history); manual Adv override wins once then returns to DIS; Exhaustion stepper persists its level; validation rejects stack 7 and bogus advantageMode via curl.

---

## 16b — Campaigns v1 (party play)

**Scope discipline: v1 is join-a-party + shared roll feed + DM read-only sheet view. No chat, no shared encounters, no permissions matrix.**

### Data (SQLite — follow the R13 schema/transaction idioms in `src/lib/db.ts`)
```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,   -- 6-char A-Z0-9 join code
  dm_user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaign_members (
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  character_id TEXT,                      -- the character they play in this campaign (nullable until chosen)
  joined_at TEXT NOT NULL, PRIMARY KEY (campaign_id, user_id)
);
CREATE TABLE IF NOT EXISTS campaign_rolls (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, character_name TEXT NOT NULL,
  label TEXT NOT NULL, detail TEXT NOT NULL, total INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rolls_campaign_time ON campaign_rolls(campaign_id, created_at);
```
Cap: keep only the newest 200 rolls per campaign (DELETE older inside the insert transaction).

### API (all cookie-authenticated; validation caps: name ≤60, one campaign per DM for v1 is NOT enforced — users may create several)
- `POST /api/campaigns` `{name}` → creates campaign, caller = DM, generates unique code (retry loop on UNIQUE violation).
- `POST /api/campaigns/join` `{code, characterId}` → membership upsert (member may switch character by re-joining). Verify the character belongs to the caller.
- `GET /api/campaigns` → campaigns the caller DMs or belongs to (with member count).
- `GET /api/campaigns/:id` → detail: members (user name, character id+name+class+level pulled from character JSON), latest 50 rolls. **DM additionally gets each member character's full JSON** (read-only view source). Non-members: 404.
- `POST /api/campaigns/:id/rolls` `{label, detail, total}` (strings capped 80/200, total int −999..999) → insert.
- `DELETE /api/campaigns/:id` (DM only) and `DELETE /api/campaigns/:id/members/me` (leave).

### Client
- **Campaign drawer/panel:** a new "Campaign" entry point in the top bar (next to the account chip): create (name → shows the code to share), join (code + pick one of your characters), and when active: member list + live roll feed.
- **Feed = polling, not websockets** (pre-decided): while the campaign panel is open, poll `GET /api/campaigns/:id` every 5s; pause polling when the panel is closed or the tab is hidden (`document.visibilityState`).
- **Roll sharing:** when the player has an active campaign selected (localStorage `forge-and-fable-active-campaign`), every roll that lands in the local roll history ALSO fires `POST .../rolls` (fire-and-forget; failures logged to console only). Reuse the exact strings from `RollHistoryEntry` (label/detail/total).
- **DM sheet view:** from the member list, the DM can open a member's character in a READ-ONLY sheet: reuse `HeroSheet` with a new prop `readOnly?: boolean` that (a) replaces `onUpdate` with a no-op, (b) hides edit affordances (steppers, toggles, add forms, layout/skin tools) via a `data-readonly` attribute + CSS `pointer-events: none` on interactive sub-regions EXCEPT scrolling and tab switching, (c) banner "Viewing <name> (read-only)". Do not fork the component.
- Theming: campaign panel uses dark-chrome idiom (it's chrome, not paper).

### Verification (two-browser requirement)
Two browser profiles: A creates campaign + shares code; B registers separately, joins with a character; A sees B in members within one poll; B rolls on their sheet → roll appears in A's feed ≤5s; A opens B's sheet read-only (interactions genuinely dead — click a stepper, verify no PUT on the wire and no state change); B leaves; A deletes campaign. Also: non-member curl of `GET /api/campaigns/:id` → 404; roll POST with 300-char label → 400.

`docs/CHANGES-16a.md` + `docs/CHANGES-16b.md`. No entry = not done.
