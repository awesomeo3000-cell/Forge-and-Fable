# Forge & Fable — Road to 1.0

**Status date:** 2026-07-08 (reviewed through R12 — see `CHANGES-10-12-review.md`). Build clean.
**Progress:** R10–R12 done & reviewed (§2.1/.3/.4/.5/.7, §3.10/.11 closed; §3.13 skipped by user decision; §2.6 open). Next: R13 (SQLite + auth hosting gate).
**Audience:** whichever AI (or human) picks up a round. Assume no memory of prior sessions — this document plus the repo IS the memory.
**Companion documents:** `docs/QA-REPORT-2026-07-04.md` (the 43-issue audit; P0s fixed, P1–P3 open), `docs/CHANGES-*.md` (what every prior round did and how it was verified), `docs/ai-project-proposal-*.md` (the proposal format that works).

---

## 0. How work gets done here (read before anything else)

The process that produced everything below, refined over nine rounds:

1. **One round = one proposal doc** (`docs/ai-project-proposal-N.md`): context section, exact task specs with acceptance criteria, hard constraints, landmine list, verification requirements.
2. **Match task type to agent tier.** Mechanical, fully-specified tasks (data entry, specced CSS, single-field features following an existing pattern) → cheap agent (DeepSeek-class). Layout refactors, new surfaces, multi-file features → capable agent (Codex-class). Roll-pipeline changes, derived-stat math, storage/auth migrations, anything touching `pushRoll`/`pushPool`/effects → strongest available agent, with review.
3. **Changelog is mandatory:** `docs/CHANGES-N.md`, one entry per task — what changed, what was clicked in the running app, what was observed. *No entry = not done.* "It compiles" is not verification; walk the feature in the browser.
4. **Review gate:** after each round, a separate review pass checks the diff against the spec AND runs the app. History says cheap agents fail specifically at: async/callback timing, `undefined` vs `null`, CSS cascade interactions, and anything requiring a judgment call the spec didn't pre-make. Review those first.

### The landmine list (institutional knowledge — every item here has caused a real bug)

- `JSON.stringify` drops `undefined`. Clearing a persisted field over PUT requires `null` (see `theme`). `Character` fields that can be cleared must be typed `| null`.
- Never define a CSS variable in terms of itself (`--x: var(--x), fallback`) — silent document-wide invalidation. This shipped once and broke the entire font system.
- `globals.css` (~6k lines) is append-ordered layers. New rules go at the END. Legacy builder classes hardcode dark-theme colors (`#fff4da`, `rgba(5,6,7,…)` gradients); on paper surfaces they render as grey mush — use fresh class names or scoped overrides.
- Positional selectors (`.cs-sheet-col:nth-child(n)`) exist — inserting sibling elements into structures you don't own breaks widths (bit us with column dividers).
- The vault (`data/forge-vault.json`) is read-modify-write with **no locking** — concurrent PUTs lose updates. Combine related changes into ONE `onUpdate` patch (see `castSpell`). This is also why the SQLite migration (§5) exists.
- Dice roll callbacks fire ~4s after click (animation). Any button triggering a roll-with-callback needs an in-flight guard (see `hitDiceRolling` ref) or rapid clicks corrupt state.
- Registration is non-atomic: the user is written to the vault before token signing; a signing failure still consumes the email.
- Every new persisted `Character` field needs: the type, `ALLOWED_PATCH_FIELDS`, a validation case in `validateCharacter.ts` (bounded numbers, capped strings, whitelisted enums — copy the `effects` case), and — if user-visible content — a client-side guard too.
- Sheet section ids added to `SheetSectionId`/`SECTION_TITLES`/`DEFAULT_LAYOUT`/`MOBILE_ORDER` auto-migrate into saved layouts via `mergeWithDefaults`. Never special-case a section.
- Class/species colors: `[data-class]`/`[data-species]` set `--class-a`. Dark chrome uses the raw hue, paper mixes ~75% toward ink, nothing glows on paper. Selection state is ALWAYS the app accent, never the class hue.
- Two dev servers can't run for one project (Next lock). Preview/verification servers use a separate port with a production build.
- URLs stored in the vault: https-only, length-capped, validated server-side (no data URLs — the vault is a JSON file).

---

## 1. What exists and works (verified at some point; spot-check before building on top)

- **Auth & API:** JWT (30d) + bcrypt, localStorage tokens, login throttling, 401→logout handling, JWT_SECRET enforced in production, full input validation on character create/update.
- **Builder ("dossier"):** 6-step wizard with margin-rail navigation, index-card pickers with class-color tabs, class skill-proficiency selection (PHB counts/lists, gated), background skill grants, class/species preview modals, Quickbuilder (3 questions) and 6 premade archetypes, level-at-creation choices.
- **Sheet:** paper-document design; drag/drop/hide/collapse sections + draggable column widths; per-character skins (presets, custom colors with contrast warnings, hex inputs, user-saved presets, share codes, text-size slider, background image URLs, printer preset + print CSS); equipment (SRD armor/weapons + item catalog with proficiency info, AC from armor/shield/unarmored defense); attacks from equipped weapons with damage buttons; spell preparation/casting/upcasting/concentration; pact-slot tracking; rests with hit dice; death saves; inspiration toggle; XP-less level-up wizard (HP/subclass/feat incl. half-feat ability choice + feat-granted spells/free-use tracking); level-down unwind; effects & conditions engine (flat bonuses + d20 dice riders + senses) with AC breakdown popover.
- **Dice:** movable/resizable roll drawer, ad-hoc pools (d4–d100), session history, advantage/disadvantage with kept-die highlighting, nat-20/nat-1 detection, all sheet rolls logged.
- **Data:** 13 classes (incl. Artificer), species incl. legacy variants + Forest Gnome, all species with ability bonuses, ~640k spells.json (97 artificer spells), feats, subclasses.
- **Docs:** DEPLOYMENT.md (private hosting), QA report, per-round changelogs.

## 2. Bugs & debt to clear (mostly specced already — cheap-agent fodder)

1. **[DS] QA P1 sweep (11 issues)** — headline items: alignment has no selection UI (always "Neutral"); registration hardening (rate-limit register, raise password minimum, optional invite code — see DEPLOYMENT.md's warning); remaining items enumerated in the QA report §P1. One proposal doc, one task per issue, citing the report's repro steps. **Caveat:** the QA run was destructive (it gutted globals.css and then reported the damage as bugs — since reverted) and over-counts severity in places; every issue must be re-verified against current code before fixing, and any already-fixed or self-inflicted item recorded as such in the changelog rather than 're-fixed'.
2. **[DS] QA P2/P3 sweep (32 issues)** — batch by area (a11y, UI polish, data nits). Two proposal docs. Low individual risk; the volume is the work.
3. **[CX] Round 7 pages — never implemented.** `docs/ai-project-proposal-7-pages.md` is written and still accurate (verify `SheetSectionId` hasn't drifted). Custom pages with text/image-URL blocks.
4. **[DS] Unwired settings toggles.** `usePrerequisites`, `useFeatPrerequisites` (feat prereqs ARE now enforced — wire the toggle or remove it), `useMulticlassPrerequisites`, `encumbranceType`, `ignoreCoinWeight`, `showLevelScaledSpells`, `modifiersTop`, `advancementType`, `hitPointType` (fixed vs manual — level-up always rolls). Each either gets behavior or gets removed from the UI. One task per toggle with the decision pre-made in the proposal.
5. **[DS] Non-atomic registration** — sign the token before writing the vault, or roll back on failure.
6. **[CX] Passive-skill nuance** — passives currently include `effChecks` (Guidance inflates Passive Perception). Decide: exclude riders/checks from passives (RAW-ish) behind one derived function.
7. **[DS] Dead code/CSS prune** — retired `.paper-surface` overrides for removed markup, orphaned `class-art-*` rules, `public/class-art/*.jfif` (portraits removed long ago), `dice-panel` CSS. Mechanical with a verification pass.

## 3. Rules-engine completion (feature work, mostly [CX])

8. **Floating ASIs for 2024 species** — replace the fixed-bonus approximation (see CHANGES-qa-p0-fixes §1 design note) with a +2/+1 chooser in the builder. Touches draft state + `applyRaceBonuses`.
9. **Subspecies family grouping** — base cards show "N subspecies", variants show family tag; data via explicit `familyId` on races (gnome family = rock/deep/forest; assignments enumerated in a proposal). The friend-requested version of what's currently flat cards.
10. **Tool proficiencies & languages** — class/background grants + a sheet list in Proficiencies & Training. Data tables + one section render.
11. **Currency & encumbrance** — cp/sp/gp/pp fields on inventory, carry weight vs STR, wire `encumbranceType`/`ignoreCoinWeight`. Modest math, well-specced = [DS].
12. **Conditions with teeth** — exhaustion as stacking effect levels, standard-condition presets auto-applying their real penalties through the effects engine. [Strongest agent — effects internals.]
13. **XP advancement** — XP field + threshold table + "level up available" nudge; wire `advancementType`. [DS]
14. **Multiclassing** — the big one: per-class levels, multiclass slot table, proficiency intersection rules, level-up class picker. Do LAST among rules work; touches everything. [Strongest agent, its own round, extensive spec.]

## 4. Play features

15. **Initiative tracker** — DM-less party order list (even local-only: add combatants, sort, advance turns) as a drawer tab or section. [CX]
16. **Short-rest spell recovery nuances** — wizard Arcane Recovery, warlock already done. [DS with exact rules in spec.]
17. **Roll history export/clear + longer retention** (currently 30, session-only). [DS]
18. **Campaigns/party play** — the login screen has promised it forever: party codes, shared roll feed, DM view of member sheets. Requires §5 first. Design doc before any proposal; polling beats websockets for v1. [Architecture: strongest agent; surfaces: CX.]

## 5. Infrastructure (gate for hosting + campaigns)

19. **SQLite migration** — replace the JSON vault (lost-update race, no backups, single-machine). Keep the vaultStore function signatures so routes don't change; migrate `data/forge-vault.json` on first boot; keep the JSON path as dev fallback if cheap. [Strongest agent + mandatory review.]
20. **Auth hardening for hosting** — httpOnly cookie sessions (kills the localStorage-XSS class), register rate-limit + invite code, password minimum 10. Pairs with QA P1 security items. [CX with tight spec.]
21. **Bundle diet** — spells/subclasses/feats JSON (~900KB) ships client-side while the tiny ruleset is fetched dynamically; invert (serve big data from API routes with caching, or code-split). Measure first. [CX]
22. **Backups** — nightly vault/db file copy with rotation; a one-line restore doc. [DS]

## 6. Polish backlog

23. **Mobile pass** — the sheet works at 380px but the builder rail, roll drawer, and modals deserve a dedicated round with device screenshots. [CX]
24. **Accessibility completion** — QA's P0 ARIA fixes landed; finish: focus traps in all modals, escape-to-close everywhere, right-click-only save-proficiency toggle needs a keyboard path, contrast audit under the darkest presets. [DS with checklist]
25. **Onboarding** — empty vault state points at "New character," but nothing explains skins/layout/effects/dice; add a dismissible first-run tour card on the sheet. [CX]
26. **Empty/error states** — sweep every list for a designed empty state; the API-error toast pattern (status chip) applied consistently. [DS]
27. **Performance niceties** — sheet re-renders whole-tree on every keystroke into console input (state lives in the app root); memoize or relocate. [CX]

## 7. Release gate for 1.0

- [ ] All §2 items closed; QA P1 = 0 open.
- [ ] `npm run lint` 0 errors 0 warnings; `npm run build` clean.
- [ ] Full manual pass: register → build (standard + quickbuilder + premade) → play a session (rolls, adv/dis, effects, rest, level up 1→5 incl. feat + spells) → skin it → print it → export/import it — on desktop AND a phone.
- [ ] Two-browser concurrency smoke test against the hosted instance (no lost updates — requires §19).
- [ ] Data licensing check before any public link: SRD 5.1 content is CC-BY-4.0 (include attribution); **Artificer and several subclasses/spells are NOT SRD** — fine for a private friends instance, not for public distribution. Keep the deployment private (per DEPLOYMENT.md) or trim non-SRD content for a public build.
- [ ] `README.md` rewritten for the actual feature set; screenshots refreshed; version tagged.

## 8. Suggested sequencing

| Round | Contents | Tier |
|---|---|---|
| R10 | §2.1 P1 sweep + §2.4 settings toggles + §2.5 + §2.7 | DS |
| R11 | §3.9 subspecies + §3.10 tools/languages + §3.13 XP + §3.11 currency | DS |
| R12 | §2.3 pages + §3.8 floating ASIs + §6.23 mobile | CX |
| R13 | §5.19 SQLite + §5.20 auth (the hosting gate) | Strong + review |
| R14 | §2.2 P2/P3 sweeps + §6.24 a11y + §6.26 empty states | DS |
| R15 | §4.15 initiative tracker + §6.25 onboarding + §5.21 bundle | CX |
| R16 | §3.12 conditions + §4.18 campaigns v1 | Strong |
| R17 | §3.14 multiclassing (optional for 1.0 — cut if scope demands) | Strong |
| — | Release gate (§7), tag 1.0 | — |

Rounds R10–R15 are fully executable from this document plus the QA report. R13 and R16 deserve fresh design passes before their proposals are written — whoever writes them: read the landmine list twice, and verify in the running app like every round before you.
