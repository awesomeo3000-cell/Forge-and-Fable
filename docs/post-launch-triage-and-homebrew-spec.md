# Post-Launch Fixes + Homebrew Builder — Spec & Model-Tier Triage

Compiled 2026-07-18 from owner's post-debut friend feedback. Six items: five
bounded fixes/features and one XL epic (homebrew builder). Each item below has:
symptom → where it lives → approach → size → **model tier** → risks.

**Model tiers used here**
- **Grunt (cheap — Haiku-class):** one/two files, unambiguous fix, exact spec, no
  design decisions. CSS, copy, contained rules constants.
- **Mid (Sonnet-class):** multi-file, some debugging, rules logic, moderate
  integration; a clear spec but judgment needed in the middle.
- **Capable (Opus-class):** cross-cutting design, new data models, async/infra
  debugging with unknown root cause, or decomposition of the epic.

Rule of thumb: **anything with an unknown root cause, a new shared abstraction,
or a data-model change is NOT grunt work** — grunt models thrash on those and
produce plausible-but-wrong diffs. Give cheap models the items where the spec
already contains the answer.

---

## F1 · Attunement limit (Artificer scales; everyone else = 3)

**Symptom:** attunement limit is a flat 3; Artificer should reach 6.
**Rule:** every character can attune to **3** magic items. Artificer's
`Magic Item Adept` (L10) → 4, `Magic Item Savant` (L14) → 5,
`Magic Item Master` (L18) → 6. (Features already exist in
`src/lib/ruleset.ts:598/602/606`.)
**Where:** no limit is enforced today — the sheet only renders a per-item
"Attunement" badge (`HeroSheet.tsx:1966`). Need (a) a helper
`attunementLimit(classId, level)` and (b) a sheet indicator "Attuned N/limit"
with an over-limit warning.
**Approach:** pure helper keyed off class + the three Artificer feature levels;
count items where `item.attunement && item.attuned`. Surface in the inventory
header. No new persistence if "attuned" state already exists — **verify whether
items track an `attuned` boolean first**; if not, that's a small schema add
(then this becomes Mid).
**Size:** S (S→M if `attuned` state must be added). **Tier: Grunt** with the
rule spelled out; **Mid** if a schema field is needed. **Risk:** low — confirm
the attuned-vs-owned distinction before writing the counter.

## F2 · PDF import stuck on "uploading", never finishes

**Symptom:** the character PDF import hangs on upload.
**Where:** `CharacterImportModal.tsx` (`runImportJob` → `jobId` →
poll → `completeImportJob`, lines ~256–288); OCR job pipeline + routes
`/api/pdf-imports/*`; flag **`PDF_IMPORT_OCR_ENABLED`**.
**Most likely causes (in order):** (1) the flag isn't set in the deployed env,
so the OCR route 501s and the client's fallback/poll never resolves; (2) the
OCR worker (`workers/ocr/*`, tesseract/pdfjs raster) isn't running or times out
on the host (Render/Railway native Node, no Docker); (3) a polling bug where the
job never reaches a terminal state.
**Approach:** reproduce locally with the flag on, watch the job state machine
and the diagnostics route; then confirm the deployed env (owner action: check
`PDF_IMPORT_OCR_ENABLED` + worker presence in prod). Add a hard timeout + user-
visible failure state so it can never hang silently, regardless of root cause.
**Size:** M (debugging-led, unknown root cause + possible infra). **Tier:
Capable** — async pipeline + env. **Risk:** may be an environment/flag issue, not
code; needs owner to verify prod. Do not hand to a cheap model — it will "fix"
symptoms blindly.

## F3 · DM roll-requests inherit the target's effects (adv/dis/bonus dice)

**Symptom:** a requested check ignores the responder's active
effects/conditions. Poisoned → should roll at **disadvantage**; Bless → should
add **+1d4**; Guidance → +1d4; etc.
**Where:** the sheet ALREADY computes this for self-initiated rolls —
`HeroSheet.tsx`: `effChecks = effectTotal(effectsList, "checks")`,
`d20OptionsForAbility()` (adv/dis from conditions), `rollD20ForAbility()`. The
DM request path does NOT reuse it: `dmToolsApi.createRequest` (DMTablePanel) →
player responds via `handleCampaignRollRequest` / `respondToRequest`
(`ForgeAndFableApp.tsx:1679, 2519`), which rolls with a plain modifier.
**Approach:** extract the effect→d20 resolution (advantage mode + flat check
bonus + bonus dice like +1d4) out of HeroSheet into a shared, tested lib
(`src/lib/effects/rollModifiers.ts` — `resolveCheckModifiers(character,
{ability, kind})`). Then the roll-request **response** computes modifiers from
the responder's live effects using that lib, so the answer matches what the
player would get rolling it themselves. Optionally show the DM a preview ("at
disadvantage — poisoned") in the request/response feed.
**Size:** L (cross-cutting; the shared extraction is the real work). **Tier:
Capable** for the extraction + design; once the lib exists, wiring it into the
response path and adding preview text are **Mid/Grunt** sub-tasks. **Risk:**
correctness of the condition→mechanic mapping (poisoned, frightened, blessed,
guidance, bane…); must not double-apply if the sheet also applies them.
**Dependency:** the effects model in HeroSheet is the source of truth — extract,
don't reimplement.

## F4 · "Delete campaign" shows the name in ALL CAPS (misleading)

**Symptom:** the confirm reads "Type **CAMPAIGNNAME** to confirm" but the real
name isn't uppercase, so users type the wrong thing.
**Where:** `CampaignSettingsSection.tsx:107` renders
`Type <strong>{campaign.name}</strong> to confirm` inside `.ao-cw-field`, whose
label `span` has `text-transform: uppercase` (arcane-observatory.css) — it
uppercases the injected name too. Match check `deleteMatches` is
case-**sensitive** (`:37`).
**Approach:** (1) CSS `text-transform: none` on the injected `<strong>` (so the
real casing shows); (2) make the match case-insensitive as a safety net. Two
lines.
**Size:** S. **Tier: Grunt** — exact fix, hand it off. **Risk:** none.

## F5 · Conditions take a long time to apply

**Symptom:** applying a condition from the DM table lags noticeably.
**Where:** `DMTablePanel.tsx:518` `applyCondition` posts a `condition-apply`
event; the change only reflects after the next campaign **sync poll** — so
latency ≈ the poll interval, not the request.
**Approach:** optimistic local application (update the local combatant/member
immediately) then reconcile on the next sync; or push the condition through the
faster live channel. Guard against double-apply when the authoritative sync
returns.
**Size:** M. **Tier: Mid** (Capable if the sync/reconcile model turns out
gnarly). **Risk:** double-application / flicker on reconcile — needs an idempotent
merge keyed by event id.

---

## H · Comprehensive homebrew builder (the epic — its own track)

**Ask:** author custom **characters, classes, subclasses, feats, spells,
attacks, items** — "pretty much everything" — with an intuitive builder. Edge
case: **levelable items** that gain new properties at set levels.

This is XL and must not be lumped with F1–F5. Today all content is **static
JSON** (`src/data/*.json`, `rules-research/**`) loaded read-only; there's no
user-content store. The build is a decomposition problem first.

**Phase H0 — Architecture (Capable/Architect, spec only, no owner-visible UI):**
- Data model for user content: a `homebrew_content` store (per type + owner +
  visibility/share), or per-type tables. Decide merge semantics with the static
  catalogs (user content appears alongside SRD in every picker) and share codes
  (skins already do this — reuse the pattern).
- Per-type JSON schemas + validation (reuse `src/lib/progression/packets.ts`
  normalizers as the model; classes/subclasses already have a packet shape).
- Integration points: creator flow, spell picker, feat picker, item catalog,
  attack list — each must accept homebrew entries.
- Deliverable: a written schema + one **vertical slice** target.

**Phase H1 — Vertical slice: ONE simple type end-to-end (Capable designs, Mid
builds).** Recommend **Items** or **Feats** (self-contained, small schema):
CRUD builder UI → store → validation → appears in the relevant picker → usable
on the sheet. This proves the whole pipeline before scaling.

**Phase H2 — Replicate for the "leaf" types (Grunt/Mid per type, once H1 sets
the pattern):** spells, feats, items, attacks/weapons. Each is the same
CRUD-+-picker pattern with a different schema — good cheap-model work **with H1
as the reference implementation**.

**Phase H3 — Classes & subclasses (Capable).** Hardest: they must feed the
existing **progression engine** + packet catalog (`src/lib/progression/*`), not
just render. Homebrew class → progression packet; homebrew subclass → subclass
packet. High integration risk.

**Phase H4 — Levelable items (Capable, novel sub-system).** An "item
progression": properties/bonuses unlocked at owner-defined levels, tracked
per-item on the character, surfaced on the sheet. New concept modeled loosely on
class progression. Depends on H1 (item schema) + H3 patterns.

**Recommendation:** treat H as a **separate multi-round plan** with its own gate.
Do H0 + H1 first and *stop for owner review* before committing to H2–H4 — the
epic's scope (and whether classes/levelable-items are even in v1) is an owner
call, not something to build straight through.

---

## Triage summary

| Item | Size | Tier | Notes |
|---|---|---|---|
| F4 Delete-campaign caps | S | **Grunt** | exact 2-line fix; do first |
| F1 Attunement limit | S–M | **Grunt→Mid** | grunt if `attuned` state exists |
| F5 Conditions slow | M | **Mid** | optimistic apply + idempotent reconcile |
| F3 Roll-request effects | L | **Capable** | extract shared effect-modifier lib first |
| F2 PDF stuck uploading | M | **Capable** | unknown cause + prod env; owner checks flag |
| H Homebrew builder | XL | **Capable→(Grunt)** | H0/H1 capable; H2 grunt-able after |

**Suggested order:** F4 → F1 (quick wins) → F5 → F2 (bugs) → F3 (feature) → H
(own track, gated at H1).

**Hand to cheap models now (spec is complete):** F4, F1 (after confirming the
attuned field), and — once F3's shared lib and H1's pattern exist — F3's wiring
sub-tasks and H2's per-type builders. **Keep on capable models:** F2, F3-core,
F5-if-gnarly, and all of H0/H1/H3/H4.
