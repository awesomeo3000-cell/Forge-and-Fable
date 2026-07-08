# Forge & Fable — Round 16: Conditions with teeth + Live Campaigns (push model)

**Audience:** strongest available agent (Codex-class minimum), fresh session. Three sub-rounds — **16a MUST land before 16b** (pushed conditions rely on it); 16c builds on 16b. Separate commits and changelogs per sub-round. All design decisions are pre-made; re-anchor drifted code references by grep, don't redesign.
**Read first:** `docs/ROADMAP-1.0.md` §0. **Before each sub-round:** checkpoint commit.

---

## 16a — Conditions with teeth (effects-engine extension)

Today the standard conditions (Blinded, Poisoned, etc.) are label-only presets in the effects engine. Give the common ones real mechanics using existing effect fields plus two new ones.

1. **New effect field `advantageMode?: "advantage" | "disadvantage"`** — while such an effect is active, the character's d20 rolls default to that mode (feeding the existing `rollMode` pipeline; an explicit user override in the drawer wins for that one roll, then reverts to the effect's mode instead of "normal"). Type + validation (enum whitelist, copy the `d20Dice` case style) + the single integration point where `rollMode` is consumed.
2. **Exhaustion as a leveled effect:** new optional `stack?: number` (1–6, validated). The "Exhaustion" preset gains a level stepper in its effects row while active. Mechanics (documented 2014-RAW simplification): stack ≥1 → `advantageMode: "disadvantage"` on all d20s; stack ≥3 adds informational text ("speed halved / HP max halved…") in the effect description — no speed/HP automation this round.
3. **Rewire condition presets** in `src/lib/effects.ts`: Blinded → disadvantage; Poisoned → disadvantage; Restrained → disadvantage + note; Invisible → advantage; Prone/Frightened/Grappled stay label-only with descriptive text.
4. UI: active effects with `advantageMode` show a small ADV/DIS chip; the roll drawer's mode control shows "(from effects)" when an effect is driving it.

**Accept:** toggle Poisoned → next sheet d20 rolls 2d20-keep-lower automatically (verify in roll history); manual Adv override wins once then returns to the effect's DIS; Exhaustion stepper persists; curl rejects `stack: 7` and bogus `advantageMode`.

---

## 16b — Live campaigns (join, feed, shared initiative, DM pushes)

**Core architectural rule (non-negotiable): the DM never writes another user's character.** Anything that changes a player's character travels as a **campaign event**; the *player's own client* receives it on its next sync and applies it through the normal `onUpdate` → `validateCharacterInput` path. This preserves the ownership/validation model that every prior round relies on. Shared non-character state (initiative, feed) lives in campaign tables that the server owns.

### Schema (follow `src/lib/db.ts` idioms from R13: `CREATE TABLE IF NOT EXISTS`, `BEGIN IMMEDIATE` transactions)

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,   -- 6-char A-Z0-9 join code
  dm_user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaign_members (
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  character_id TEXT,                      -- nullable until chosen; re-join switches it
  joined_at TEXT NOT NULL, PRIMARY KEY (campaign_id, user_id)
);
CREATE TABLE IF NOT EXISTS campaign_rolls (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, character_name TEXT NOT NULL,
  label TEXT NOT NULL, detail TEXT NOT NULL, total INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaign_events (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  target_user_id TEXT,                    -- NULL = broadcast to all members
  type TEXT NOT NULL,                     -- 'condition-apply' | 'condition-remove' | 'announce' (16c adds more)
  payload TEXT NOT NULL,                  -- JSON, validated per type (see below)
  created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaign_initiative (
  campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  data TEXT NOT NULL,                     -- InitiativeState JSON (same shape as the R15 local tracker)
  version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rolls_campaign_time ON campaign_rolls(campaign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_campaign_time ON campaign_events(campaign_id, created_at);
```
Retention: inside their insert transactions, keep only the newest 200 rolls and 200 events per campaign.

### API (cookie-auth; every route verifies membership; DM-only routes verify `dm_user_id`)
- `POST /api/campaigns` `{name ≤60}` → create; caller = DM; unique code (retry loop on UNIQUE violation).
- `POST /api/campaigns/join` `{code, characterId}` → upsert membership (character must belong to caller).
- `GET /api/campaigns` → campaigns caller DMs or belongs to (+ member counts).
- `GET /api/campaigns/:id` → members (name + character id/name/class/level from character JSON); DM additionally gets each member character's full JSON. Non-member → 404.
- **`GET /api/campaigns/:id/sync?since=<ISO>`** — THE polling endpoint, one round-trip per tick: `{ events: [...since, targeted-to-me or broadcast], rolls: [...since], initiative: {data, version}, members: [summary incl. per-member currentHp/maxHp/ac for the DM strip] }`.
- `POST /api/campaigns/:id/rolls` `{label ≤80, detail ≤200, total int −999..999}`.
- `POST /api/campaigns/:id/events` (DM only) `{type, targetUserId?, payload}` — payload validation per type:
  - `condition-apply`: `{label ≤48, advantageMode?, d20Dice?, ac?…}` — same field rules as the `effects` validation case (reuse it); requires `targetUserId`.
  - `condition-remove`: `{label ≤48}`; requires `targetUserId`.
  - `announce`: `{message ≤200}`; broadcast or targeted.
- `PUT /api/campaigns/:id/initiative` (DM only) `{data, version}` — optimistic concurrency: if `version` ≠ stored, 409 (client refetches and reapplies).
- `POST /api/campaigns/:id/initiative/roll` (any member) `{initiative int −99..99, characterName ≤80}` — transaction: upsert the caller's combatant (keyed `player:<user_id>`), bump version.
- `DELETE /api/campaigns/:id` (DM), `DELETE /api/campaigns/:id/members/me` (leave).

### Client
- **Campaign panel** (dark-chrome idiom, entry in the top bar): create (shows code), join (code + character picker), active view = member list + roll feed + announcements composer (DM) / banner (player).
- **Sync loop:** while in an active campaign (localStorage `forge-and-fable-active-campaign`), poll `/sync` every 5s; pause when `document.visibilityState === "hidden"`. Cursor = last event/roll timestamp seen, persisted per campaign in localStorage (initial cursor on first join = join time).
- **Event application (player side):** `condition-apply` → if no DM-sourced effect with that label exists, append to own character's `effects` (with `source: "DM"`, `active: true`) via normal `onUpdate`; status-chip toast "DM applied Poisoned". `condition-remove` → remove matching DM-sourced effect; toast. `announce` → toast + entry in the panel's feed. Events are idempotent by construction (apply checks label existence) — replays are harmless.
- **DM push UI:** in the member list, each member row gets "Condition ▾" (presets from `EFFECT_PRESETS` conditions incl. the 16a mechanical ones, plus active DM-sourced conditions listed with an ✕ to push removal) and the announcements composer.
- **Shared initiative:** when a campaign is active, the drawer's Combat tab switches to shared mode: renders the campaign `InitiativeState`; the DM gets full controls (add NPC combatants, next turn, clear — all via the versioned PUT; on 409 refetch-merge-retry once); players get ONLY their "Add <character> (roll)" button, which rolls through the local dice pipeline then POSTs `/initiative/roll` — **this is the "player rolls, appears on the DM's tracker" flow**. Turn ownership: when the active combatant id is `player:<my-user-id>`, show a "Your turn" chip in the drawer AND a status-chip toast on the tick where it becomes true. Solo (no campaign) keeps the R15 local tracker untouched.
- **DM read-only sheet view:** from a member row, open the member's character in `HeroSheet` with a new `readOnly?: boolean` prop — `onUpdate` no-op, edit affordances suppressed via a `data-readonly` attribute + CSS (interactions dead EXCEPT scrolling/tab switching), banner "Viewing <name> (read-only)". Do not fork the component.

### Verification (two browser profiles, both against one server)
DM creates + shares code; player joins with a character. Then: player rolls a sheet check → appears in DM feed ≤5s. **Player clicks roll-initiative → appears on DM's shared tracker ≤5s.** DM adds NPC "Goblin 15", advances turn → player sees order + "Your turn" fires on their turn. **DM pushes Poisoned → within one sync the player's sheet shows the effect, and the player's next d20 auto-rolls at disadvantage (16a integration — verify in the roll history detail).** DM pushes removal → effect gone. Announce → player toast. DM opens player sheet read-only → clicks change nothing, no PUTs on the wire. Negative: non-member sync → 404; player POSTs a DM-only event → 403; stale-version initiative PUT → 409. `docs/CHANGES-16b.md`.

---

## 16c — Table extras (after 16b is reviewed)

1. **Roll requests:** new event type `roll-request` (DM only): `{prompt ≤80, kind: 'save'|'check'|'skill', key: abilityKey|skillId, dc?: 1..40, targetUserId | broadcast}`. Player receives a toast-card with a "Roll" button that uses THEIR character's real modifier for that save/check/skill through the normal d20 pipeline (riders, adv/dis effects included), then posts the result to the feed as `detail: "WIS save vs DC 15 — 17 ✓"` (pass/fail computed when dc present). The DM's request card in the panel shows who has/hasn't answered.
2. **Party strip for the DM:** compact always-visible row in the campaign panel — per member: name, HP bar (currentHp/maxHp), AC, passive Perception (from the sync members summary). Updates every poll.
3. **Rest prompts:** event types `rest-short`/`rest-long` (broadcast): player gets a confirm toast ("DM calls for a long rest") that, on accept, runs their existing `doShortRest`/`doLongRest` — never auto-applied.
4. **Turn-order autopopulate:** DM button "Request initiative from party" → broadcast `roll-request` of kind initiative; player accept rolls + POSTs to the shared tracker in one action.

**Accept:** DEX-save request with DC → player one-click rolls with their real modifier, feed shows pass/fail, DM card marks them answered; party strip HP updates ≤5s after a player takes damage; rest prompt applies only on player accept. `docs/CHANGES-16c.md`.

---

## Constraints (all sub-rounds)
No new dependencies (polling only — no websockets, no SSE this round). Character writes only ever by the owning user's session. Every payload validated server-side with the caps above. Roadmap §0 landmines apply — especially: single-patch `onUpdate` for event applications (batch multiple pending condition events into ONE effects update per sync tick), and the in-flight-guard rule for any roll-with-callback the roll-request flow adds.
