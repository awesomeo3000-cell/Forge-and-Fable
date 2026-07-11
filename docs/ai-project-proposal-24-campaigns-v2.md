# Proposal 24 — Campaigns v2: The Table

**Implementer:** Codex tier, sub-rounds reviewed individually. 24b (audio) and 24c (monsters) carry the most judgment; do not hand any part of this to DeepSeek.
**Prerequisite:** proposal-23 (the R21 review gate) SHOULD land first — the party strip leans on revision-safe writes. If 23 hasn't run, run it first.
**Read first:** `ROADMAP-1.0.md` §0 landmines · `ai-project-proposal-16.md` (the push architecture this extends) · `ai-project-proposal-18.md` §1–2 (material + voice) · `CHANGES-21.md` (revisions, save coordinator, migrations — your schema changes must use the migration ledger).

## The thesis

The campaign plumbing is right (events, polling, shared initiative, revision-safe writes). The container is wrong: a modal is a place you visit; a session is a place you stay. v2 gives the DM a full-screen surface ("The Table") and keeps players on their character sheet with ambient awareness. One new capability joins the roadmap by owner request: **the DM can push audio to the players** — looping mood/battle music and one-shot sound cues.

## Hard rules

1. **No websockets.** Polling at 5s is fine at friends-scale; the revision system protects writes. If a feature seems to need push latency, design around it (see audio §24b.5) instead of adding infrastructure.
2. **No maps/VTT, no chat.** The log is a record, not a conversation. These are scope traps; refuse them even if they feel adjacent.
3. **The DM never writes another user's character** (16's architecture invariant). Everything the DM does is an event or DM-owned campaign state; effects land through the owning client's validated save path.
4. Schema changes go through the `schema_migrations` ledger (CHANGES-21 pattern), adopt existing DBs in place, and get integration tests in the existing vitest harness.
5. Ledger material + voice throughout (18 §1–2): hairlines not boxes, Archivo `--font-label` for caps chrome, flavor in italic descriptors, mechanical nouns plain. The DM surface is a dark-desk surface (it frames paper panels; the sheet stays the crown jewel).
6. `next start` server: rebuild + restart before verifying anything. Changelog per sub-round (`CHANGES-24a…e`), expected-vs-observed, no fabricated verification.
7. Test fixtures: `player-two-review@example.com` / `player-two-pass1`, campaign "Review Table" (code `EPQK9A`); register a second account freely for two-chair testing. The preview-harness browser wedges at login in the reviewer's environment — the OWNER's browser works fine; verify in a real browser and record what you saw.

## The layout (24a's target)

When the logged-in user is DM of the opened campaign, the campaign takes over the studio surface (the modal remains for non-DM members and for join/create/leave):

```
┌──────────────────────────────────────────────────────────────┐
│ THE TABLE · <campaign name>            [code] [settings] [✕] │
├──────────────┬───────────────────────────────┬───────────────┤
│ THE PARTY    │  ENCOUNTER                    │  THE RECORD   │
│ (ledger rows │  initiative tracker           │  unified log  │
│  per member, │  + DM-only combatants         │  (24c)        │
│  live)       │  + hidden flag (24c)          │               │
│              ├───────────────────────────────┤               │
│              │  COMMAND ROW (24c)            │               │
│              │  condition · announce · roll  │               │
│              │  request · rest · handout     │               │
├──────────────┴───────────────────────────────┴───────────────┤
│ THE SOUNDBOARD (24b): tracks + cues + now-playing            │
└──────────────────────────────────────────────────────────────┘
```

Stacks to a single column below ~900px. Player side gets a thin **table strip** docked on the sheet (24e; minimal audio chip earlier, see 24b).

## Sub-rounds

### 24a — The Table surface + the party strip

- New component `DMTablePanel` (full studio surface, like CreatorPanel). Route into it from ForgeAndFableApp when `campaignOpen && activeCampaign.dmUserId === user.id`; everyone else keeps the existing CampaignPanel.
- **Party strip:** one row per member from the sync payload — the DM already receives member character JSON (`getCampaignDetail`) — showing: initial-seal (class color), name, **live HP as `current/max` with a hairline bar**, AC, passive Perception, condition dots (active effects with `source: "DM"` or `advantageMode`, capped ~4 with `+n`), and spell slots remaining for casters. Refresh from the existing sync cadence; add member character summaries to `/sync` (SUMMARY fields only — hp/ac/passives/conditions/slots — not full JSON every 5s; extend `syncCampaign` accordingly and keep the payload lean).
- Keep "view sheet" (read-only HeroSheet) from a row click.
- Verify: two chairs — player damages themself, DM sees the bar move within one poll; player adds an effect, dot appears.

### 24b — The Soundboard (owner-requested; the DM is the owner's wife — make it *easy*)

**Data.** Migration adds:
- `campaign_tracks` (id, campaign_id, title ≤60, url ≤500 http(s), kind `music|cue`, sort, created_at) — the campaign's registered audio library, DM-managed CRUD.
- `campaign_audio` (campaign_id PK, track_id nullable, url, title, loop, started_at, version) — the single "now playing" row, versioned writes like initiative. NULL/stopped = silence.

**API.** `GET/POST/DELETE /api/campaigns/[id]/tracks` (DM-only for writes); `PUT /api/campaigns/[id]/audio` (DM-only, versioned, 409 on stale) to start/stop music. One-shot cues are **events**: `POST events` type `audio-cue` payload `{url, title}` — fire-and-forget, no state row. `/sync` gains the `audio` state object.

**DM UI (in The Table):** a ledger-row list of tracks — play/stop on music rows (playing row gets the accent rule + "NOW PLAYING"), a single tap on cue rows fires the cue. "Add track" = title + URL + kind, hairline form. Music rows show a loop badge. Empty state: *"The table is quiet. Add a track…"*

**Player playback — read carefully, this is where naive implementations fail:**
1. **Autoplay policy:** browsers refuse audio without a user gesture. The player client must expose an explicit **"Join table audio"** toggle (speaker icon chip, floating near the roll drawer while a campaign is active — 24e later folds it into the table strip). The first enable click plays a silent buffer to arm the element. Until armed, an incoming `audio-play` shows a toast: *"The DM started ‹title› — tap to listen"* (tap = arm + play). Never assume audio can start unprompted.
2. **State-driven, not event-driven, for music:** on every sync, reconcile the local `<audio>` element against the `audio` state object — if server says track X looping since T and local isn't playing it, start it; if server says stopped, stop. This makes reloads/late joiners/missed polls self-healing. Cues (events) play once on arrival through the same armed element pool; do NOT replay cues already in `processedCampaignEventsRef`.
3. **Rough loop sync:** on (re)start of a loop, seek to `((now - started_at) % duration)` once metadata loads. Approximate is fine — mood, not metronome.
4. **Latency honesty:** polling means cues land within ~5–10s. Fine for ambience; the spec explicitly does NOT promise synchronized stingers. While audio is armed and the tab visible, tightening the campaign poll to 3s is permitted (measure server cost first; it's one indexed read).
5. **Volume is the player's:** local volume slider + mute on the chip, persisted in localStorage. The DM does not control player volume.
6. Cleanup: pause + release the element on campaign deactivate/unmount; `useEffect` teardown, no orphaned loops (test by switching characters and logging out mid-track).

**Sourcing note for the changelog/README:** tracks are URLs — files dropped in `public/audio/` (self-hosted, private-instance licensing is the owner's call) or external direct-file links. No uploads this round.

**Verify (two chairs, real speakers):** DM plays loop → player hears within a poll after arming; reload mid-track resumes near-position; stop stops; cue fires once and doesn't replay on next sync; un-armed player gets the tap-to-listen toast; volume slider local-only.

### 24c — Monsters, hidden initiative, the command row

- Combatant entries in `campaign_initiative.data` (already versioned JSON) gain optional fields: `hidden: bool`, `hp: {current, max}`, `ac`, `note ≤120` (one attack line, e.g. "Bite +5, 2d6+3"). DM-only UI: add-combatant form (name, init, AC, HP, note, hidden), HP tick on the tracker row, reveal toggle.
- **Player-side sync must respect `hidden`:** filter hidden combatants OUT of the payload server-side for non-DM members (never ship-then-hide; grep `syncCampaign`). Reveal = the DM flips the flag; players see the entry appear in order.
- Command row: the existing DM tools (push condition, announce, request roll, call rest) compacted into one row of ledger buttons opening small inline forms; remove the stacked always-open forms.
- Verify: player sync payload (curl) contains no hidden entries; reveal mid-round appears for the player; monster HP ticks don't collide with concurrent initiative writes (versioned 409 path — aligned to 409 in proposal-23 B1).

### 24d — The Record (unified log)

- Merge rolls + events into one chronological register in The Table's right column: rolls (existing feed), conditions, rests, announces, joins/leaves, audio starts, handouts. Filter chips (All · Rolls · Table). Server: one merged query or client-side merge of the two existing feeds — prefer client merge; both feeds already arrive in sync/detail.
- Voice: entries read as register lines ("*Pip the Reviewed — DEX save 17*", "*The DM called a short rest*"). No new event types this round.

### 24e — Handouts + the player table strip

- **Handouts:** DM command "Share a handout" = title + image URL (validate like pages image blocks). Event type `handout`; players get a toast → click opens a lightbox (reuse the read-only modal scrim idiom). Handouts also listed in The Record.
- **Table strip (player):** thin docked bar on the sheet while a campaign is active: round + current turn (own turn = accent + the existing "Your turn!" toast stays), last announcement (truncated), the audio chip from 24b, and an "open campaign" button. One line, hairline top border, dismissible per-session.
- Verify: strip appears/disappears with campaign activation; turn highlight matches tracker; handout roundtrip DM→player→lightbox.

## Copy deck

Surface title: `THE TABLE` (eyebrow) · campaign name (display). Regions: `The Party` · `Encounter` · `The Record` · `The Soundboard`. Empty states: party *"No souls at the table yet — share the code."* · record *"Nothing written yet."* · soundboard *"The table is quiet. Add a track…"*. Audio toast: *"The DM started ‹title› — tap to listen."* Handout toast: *"The DM shared a handout: ‹title›."* Hidden combatant (DM view only) marker: `HIDDEN` in `--font-label` caps. Buttons stay verb-first plain: `Add track` · `Share a handout` · `Reveal` · `Call a short rest`.

## Review gate (each sub-round)

`npm test` + `typecheck` + `lint:ci` + `build` green; two-chair verification recorded with expected-vs-observed; player payloads inspected via curl for leakage (hidden combatants, other members' full JSON); no regression to the sheet, builder, or the existing player modal. The reviewer (Claude) checks material rules by computed style and copy verbatim against this document.
