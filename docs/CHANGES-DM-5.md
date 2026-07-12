# CHANGES DM-5 — Scene and NPC Operations

Implemented the fifth sub-round of `ai-project-proposal-dm-table-complete-workspace.md`.

## Delivered

- Persistent campaign scenes with title, description, read-aloud text, present characters, objectives, clues, handouts, private notes, likely checks, location, and linked encounter fields.
- Current-scene selection and active-state persistence.
- Interactive objective completion, clue revelation, and party-presence tracking.
- Linked encounters launch through the existing encounter runner without replacing session or campaign records.
- Persistent campaign NPCs with attitude, voice, goal, knowledge, reveal condition, combat facts, disposition, alive/dead/missing state, location, relationship notes, revealed secrets, scene, and journal linkage.
- Quick NPC creation, scene assignment, disposition/status editing, portrait sharing, and initiative insertion.
- A party capability matrix derived from enrolled character data for passive scores, languages, tools, and skills.
- Database revision 10 adds campaign-scoped scene and NPC records.

## Privacy and ownership

- Scene and NPC records are DM-only.
- Player-facing portrait shares still use the existing validated handout event path.
- Capability references are computed from current validated character summaries and are not duplicated in persistence.

## Automated verification

- World-store tests cover scene/NPC creation, updates, campaign scoping, active state, clues, disposition, and DM-only access.
- Existing encounter, campaign projection, typecheck, and lint checks remain clean.
