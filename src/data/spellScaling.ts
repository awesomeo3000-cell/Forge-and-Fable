import type { SpellEffect } from "@/types/spellEffects";

/**
 * Structured spell effect and scaling registry.
 *
 * Maps spell IDs to their effects with upcast scaling rules.
 * This is the authoritative source for how spells scale — the resolver
 * does NOT parse description text.
 *
 * Categories:
 *   per-slot-level  — damage/healing increases every slot level above a threshold
 *   slot-level-table — effect changes at specific slot levels
 *   none             — no scaling (base effect only)
 *
 * Spells NOT in this registry fall back to the `higherLevel` bridge field
 * on SpellData, and then to a best-effort description parse.
 */

export const SPELL_SCALING: Record<string, SpellEffect[]> = {
  // ── Level 1 Damage Spells (simple per-slot-level scaling) ────────────────

  "burning-hands": [
    {
      id: "burning-hands-fire",
      type: "damage",
      dice: "3d6",
      damageType: "fire",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  thunderwave: [
    {
      id: "thunderwave-thunder",
      type: "damage",
      dice: "2d8",
      damageType: "thunder",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d8",
      },
    },
  ],

  "chromatic-orb": [
    {
      id: "chromatic-orb-damage",
      type: "damage",
      dice: "3d8",
      damageType: "varies",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d8",
      },
    },
  ],

  "hellish-rebuke": [
    {
      id: "hellish-rebuke-fire",
      type: "damage",
      dice: "2d10",
      damageType: "fire",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d10",
      },
    },
  ],

  "guiding-bolt": [
    {
      id: "guiding-bolt-radiant",
      type: "damage",
      dice: "4d6",
      damageType: "radiant",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "inflict-wounds": [
    {
      id: "inflict-wounds-necrotic",
      type: "damage",
      dice: "3d10",
      damageType: "necrotic",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d10",
      },
    },
  ],

  "arms-of-hadar": [
    {
      id: "arms-of-hadar-necrotic",
      type: "damage",
      dice: "2d6",
      damageType: "necrotic",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  catapult: [
    {
      id: "catapult-bludgeoning",
      type: "damage",
      dice: "3d8",
      damageType: "bludgeoning",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d8",
      },
    },
  ],

  "chaos-bolt": [
    {
      id: "chaos-bolt-damage",
      type: "damage",
      dice: "2d8+1d6",
      damageType: "varies",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "dissonant-whispers": [
    {
      id: "dissonant-whispers-psychic",
      type: "damage",
      dice: "3d6",
      damageType: "psychic",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "earth-tremor": [
    {
      id: "earth-tremor-bludgeoning",
      type: "damage",
      dice: "1d6",
      damageType: "bludgeoning",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "ensnaring-strike": [
    {
      id: "ensnaring-strike-piercing",
      type: "damage",
      dice: "1d6",
      damageType: "piercing",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "hail-of-thorns": [
    {
      id: "hail-of-thorns-piercing",
      type: "damage",
      dice: "1d10",
      damageType: "piercing",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d10",
      },
    },
  ],

  // Ice Knife: piercing doesn't scale, cold scales +1d6 per level
  "ice-knife": [
    {
      id: "ice-knife-piercing",
      type: "damage",
      dice: "1d10",
      damageType: "piercing",
      scaling: { type: "none" },
    },
    {
      id: "ice-knife-cold",
      type: "damage",
      dice: "2d6",
      damageType: "cold",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "ray-of-sickness": [
    {
      id: "ray-of-sickness-poison",
      type: "damage",
      dice: "2d8",
      damageType: "poison",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d8",
      },
    },
  ],

  "searing-smite": [
    {
      id: "searing-smite-fire",
      type: "damage",
      dice: "1d6",
      damageType: "fire",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "thunderous-smite": [
    {
      id: "thunderous-smite-thunder",
      type: "damage",
      dice: "2d6",
      damageType: "thunder",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "witch-bolt": [
    {
      id: "witch-bolt-lightning",
      type: "damage",
      dice: "1d12",
      damageType: "lightning",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "wrathful-smite": [
    {
      id: "wrathful-smite-psychic",
      type: "damage",
      dice: "1d6",
      damageType: "psychic",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "magic-missile": [
    {
      id: "magic-missile-force",
      type: "damage",
      dice: "3d4+3",
      damageType: "force",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d4+1",
      },
    },
  ],

  // ── Level 1 Healing Spells ───────────────────────────────────────────────

  "cure-wounds": [
    {
      id: "cure-wounds-healing",
      type: "healing",
      dice: "1d8",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d8",
      },
    },
  ],

  "healing-word": [
    {
      id: "healing-word-healing",
      type: "healing",
      dice: "1d4",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d4",
      },
    },
  ],

  // ── Level 2 Damage Spells ────────────────────────────────────────────────

  "blindness-deafness": [
    {
      id: "blindness-deafness-condition",
      type: "damage",
      dice: "",
      damageType: "Blinded",
    },
  ],

  "cloud-of-daggers": [
    {
      id: "cloud-of-daggers-slashing",
      type: "damage",
      dice: "4d4",
      damageType: "slashing",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "2d4",
      },
    },
  ],

  "flaming-sphere": [
    {
      id: "flaming-sphere-fire",
      type: "damage",
      dice: "2d6",
      damageType: "fire",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d6",
      },
    },
  ],

  "melfs-acid-arrow": [
    {
      id: "melfs-acid-arrow-acid",
      type: "damage",
      dice: "4d4",
      damageType: "acid",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d4",
      },
    },
  ],

  "scorching-ray": [
    {
      id: "scorching-ray-fire",
      type: "damage",
      dice: "2d6",
      damageType: "fire",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d6",
      },
    },
  ],

  "shatter": [
    {
      id: "shatter-thunder",
      type: "damage",
      dice: "3d8",
      damageType: "thunder",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d8",
      },
    },
  ],

  "spiritual-weapon": [
    {
      id: "spiritual-weapon-force",
      type: "damage",
      dice: "1d8",
      damageType: "force",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d8",
      },
    },
  ],

  // ── Level 2 Healing ──────────────────────────────────────────────────────

  "prayer-of-healing": [
    {
      id: "prayer-of-healing-healing",
      type: "healing",
      dice: "2d8",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d8",
      },
    },
  ],

  // NOTE: Blindness/Deafness has no scaling — condition effect only.
  // Spells like Hold Person scale targets, not dice — handled in a future phase.
  // Goodberry has no scaling — fixed 10 berries.

  // ── Level 3 Damage Spells ────────────────────────────────────────────────

  "fireball": [
    {
      id: "fireball-fire",
      type: "damage",
      dice: "8d6",
      damageType: "fire",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d6",
      },
    },
  ],

  "lightning-bolt": [
    {
      id: "lightning-bolt-lightning",
      type: "damage",
      dice: "8d6",
      damageType: "lightning",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d6",
      },
    },
  ],

  "call-lightning": [
    {
      id: "call-lightning-lightning",
      type: "damage",
      dice: "3d10",
      damageType: "lightning",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d10",
      },
    },
  ],

  "spirit-guardians": [
    {
      id: "spirit-guardians-necrotic",
      type: "damage",
      dice: "3d8",
      damageType: "necrotic",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d8",
      },
    },
  ],

  "vampiric-touch": [
    {
      id: "vampiric-touch-necrotic",
      type: "damage",
      dice: "3d6",
      damageType: "necrotic",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d6",
      },
    },
  ],

  // ── Level 3 Healing ──────────────────────────────────────────────────────

  "mass-healing-word": [
    {
      id: "mass-healing-word-healing",
      type: "healing",
      dice: "1d4",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d4",
      },
    },
  ],

  // ── Level 4+ Spells (key examples) ───────────────────────────────────────

  blight: [
    {
      id: "blight-necrotic",
      type: "damage",
      dice: "8d8",
      damageType: "necrotic",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 4,
        dicePerLevel: "1d8",
      },
    },
  ],

  "ice-storm": [
    {
      id: "ice-storm-bludgeoning",
      type: "damage",
      dice: "2d8",
      damageType: "bludgeoning",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 4,
        dicePerLevel: "1d8",
      },
    },
    {
      id: "ice-storm-cold",
      type: "damage",
      dice: "4d6",
      damageType: "cold",
      saveResult: "half",
      scaling: { type: "none" },
    },
  ],

  // ── Spells with NO mechanical upcast currently supported ─────────────────
  // These consume a slot but have no structured scaling data yet.
  // They will show the base description and the save/condition info.

  // ── Level 1 additional damage spells ─────────────────────────────────────

  "absorb-elements": [
    {
      id: "absorb-elements-damage",
      type: "damage",
      dice: "1d6",
      damageType: "varies",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d6",
      },
    },
  ],

  "acid-stream": [
    {
      id: "acid-stream-acid",
      type: "damage",
      dice: "2d4",
      damageType: "acid",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d4",
      },
    },
  ],

  "magnify-gravity": [
    {
      id: "magnify-gravity-force",
      type: "damage",
      dice: "2d8",
      damageType: "force",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d8",
      },
    },
  ],

  "cause-fear": [
    {
      id: "cause-fear-frightened",
      type: "damage",
      dice: "",
      damageType: "Frightened",
    },
  ],

  // ── Level 2 additional damage spells ────────────────────────────────────

  "aganazzar-s-scorcher": [
    {
      id: "aganazzar-scorcher-fire",
      type: "damage",
      dice: "3d8",
      damageType: "fire",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d8",
      },
    },
  ],

  moonbeam: [
    {
      id: "moonbeam-radiant",
      type: "damage",
      dice: "2d10",
      damageType: "radiant",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d10",
      },
    },
  ],

  "snilloc-s-snowball-swarm": [
    {
      id: "snowball-swarm-cold",
      type: "damage",
      dice: "3d6",
      damageType: "cold",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d6",
      },
    },
  ],

  "heat-metal": [
    {
      id: "heat-metal-fire",
      type: "damage",
      dice: "2d8",
      damageType: "fire",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d8",
      },
    },
  ],

  "dust-devil": [
    {
      id: "dust-devil-bludgeoning",
      type: "damage",
      dice: "1d8",
      damageType: "bludgeoning",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d8",
      },
    },
  ],

  "branding-smite": [
    {
      id: "branding-smite-radiant",
      type: "damage",
      dice: "2d6",
      damageType: "radiant",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d6",
      },
    },
  ],

  "mind-thrust": [
    {
      id: "mind-thrust-psychic",
      type: "damage",
      dice: "3d6",
      damageType: "psychic",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d6",
      },
    },
  ],

  "mind-spike": [
    {
      id: "mind-spike-psychic",
      type: "damage",
      dice: "3d8",
      damageType: "psychic",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d8",
      },
    },
  ],

  "dragon-s-breath": [
    {
      id: "dragon-breath-damage",
      type: "damage",
      dice: "3d6",
      damageType: "varies",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d6",
      },
    },
  ],

  "healing-spirit": [
    {
      id: "healing-spirit-healing",
      type: "healing",
      dice: "1d6",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 2,
        dicePerLevel: "1d6",
      },
    },
  ],

  // ── Level 3 additional damage spells ────────────────────────────────────

  "erupting-earth": [
    {
      id: "erupting-earth-bludgeoning",
      type: "damage",
      dice: "3d12",
      damageType: "bludgeoning",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d12",
      },
    },
  ],

  "pulse-wave": [
    {
      id: "pulse-wave-force",
      type: "damage",
      dice: "6d6",
      damageType: "force",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d6",
      },
    },
  ],

  "thunder-step": [
    {
      id: "thunder-step-thunder",
      type: "damage",
      dice: "3d10",
      damageType: "thunder",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d10",
      },
    },
  ],

  "psionic-blast": [
    {
      id: "psionic-blast-force",
      type: "damage",
      dice: "5d8",
      damageType: "force",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d8",
      },
    },
  ],

  "life-transference": [
    {
      id: "life-transference-necrotic",
      type: "damage",
      dice: "4d8",
      damageType: "necrotic",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d8",
      },
    },
  ],

  "melf-s-minute-meteors": [
    {
      id: "minute-meteors-fire",
      type: "damage",
      dice: "2d6",
      damageType: "fire",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 3,
        dicePerLevel: "1d6",
      },
    },
  ],

  // ── Level 4+ additional damage spells ────────────────────────────────────

  "vitriolic-sphere": [
    {
      id: "vitriolic-sphere-acid",
      type: "damage",
      dice: "10d4",
      damageType: "acid",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 4,
        dicePerLevel: "2d4",
      },
    },
  ],

  "storm-sphere": [
    {
      id: "storm-sphere-bludgeoning",
      type: "damage",
      dice: "2d6",
      damageType: "bludgeoning",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 4,
        dicePerLevel: "1d6",
      },
    },
  ],

  "gravity-sinkhole": [
    {
      id: "gravity-sinkhole-force",
      type: "damage",
      dice: "5d10",
      damageType: "force",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 4,
        dicePerLevel: "1d10",
      },
    },
  ],

  "phantasmal-killer": [
    {
      id: "phantasmal-killer-psychic",
      type: "damage",
      dice: "4d10",
      damageType: "psychic",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 4,
        dicePerLevel: "1d10",
      },
    },
  ],

  // ── Level 5+ ─────────────────────────────────────────────────────────────

  "cone-of-cold": [
    {
      id: "cone-of-cold-cold",
      type: "damage",
      dice: "8d8",
      damageType: "cold",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 5,
        dicePerLevel: "1d8",
      },
    },
  ],

  cloudkill: [
    {
      id: "cloudkill-poison",
      type: "damage",
      dice: "5d8",
      damageType: "poison",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 5,
        dicePerLevel: "1d8",
      },
    },
  ],

  "flame-strike": [
    {
      id: "flame-strike-fire",
      type: "damage",
      dice: "4d6",
      damageType: "fire",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 5,
        dicePerLevel: "1d6",
      },
    },
  ],

  "insect-plague": [
    {
      id: "insect-plague-piercing",
      type: "damage",
      dice: "4d10",
      damageType: "piercing",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 5,
        dicePerLevel: "1d10",
      },
    },
  ],

  enervation: [
    {
      id: "enervation-necrotic",
      type: "damage",
      dice: "4d8",
      damageType: "necrotic",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 5,
        dicePerLevel: "1d8",
      },
    },
  ],

  "mass-cure-wounds": [
    {
      id: "mass-cure-wounds-healing",
      type: "healing",
      dice: "3d8",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 5,
        dicePerLevel: "1d8",
      },
    },
  ],

  // ── Level 6+ ─────────────────────────────────────────────────────────────

  disintegrate: [
    {
      id: "disintegrate-force",
      type: "damage",
      dice: "10d6+40",
      damageType: "force",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 6,
        dicePerLevel: "3d6",
      },
    },
  ],

  "chain-lightning": [
    {
      id: "chain-lightning-lightning",
      type: "damage",
      dice: "10d8",
      damageType: "lightning",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 6,
        dicePerLevel: "1d8",
      },
    },
  ],

  "circle-of-death": [
    {
      id: "circle-of-death-necrotic",
      type: "damage",
      dice: "8d6",
      damageType: "necrotic",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 6,
        dicePerLevel: "2d6",
      },
    },
  ],

  "freezing-sphere": [
    {
      id: "freezing-sphere-cold",
      type: "damage",
      dice: "10d6",
      damageType: "cold",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 6,
        dicePerLevel: "1d6",
      },
    },
  ],

  "gravity-fissure": [
    {
      id: "gravity-fissure-force",
      type: "damage",
      dice: "8d8",
      damageType: "force",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 6,
        dicePerLevel: "1d8",
      },
    },
  ],

  // ── Level 7+ ─────────────────────────────────────────────────────────────

  "delayed-blast-fireball": [
    {
      id: "delayed-blast-fireball-fire",
      type: "damage",
      dice: "12d6",
      damageType: "fire",
      saveResult: "half",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 7,
        dicePerLevel: "1d6",
      },
    },
  ],

  // ── Healing extras ───────────────────────────────────────────────────────

  "false-life": [
    {
      id: "false-life-healing",
      type: "healing",
      dice: "1d4+4",
      scaling: {
        type: "per-slot-level",
        startsAboveLevel: 1,
        dicePerLevel: "1d4",
      },
    },
  ],

  // ── Spells needing manual review ─────────────────────────────────────────
  // Attack-roll spells (Scorching Ray, Chromatic Orb, etc.): damage should
  // NOT auto-roll on cast — the player must confirm hits first.
  // Summoning spells: no damage roll on cast.
  // Multi-target scaling: adds targets, not dice.
  // Threshold-based scaling: use slot-level-table.
};

/** Spells that have been audited and classified.
 *  Used to produce the completion report. */
export const SPELL_SCALING_AUDIT: Record<
  string,
  { category: string; needsReview: boolean; notes?: string }
> = {
  "burning-hands": { category: "damage-scaling", needsReview: false },
  thunderwave: { category: "damage-scaling", needsReview: false },
  "chromatic-orb": { category: "damage-scaling", needsReview: false },
  "hellish-rebuke": { category: "damage-scaling", needsReview: false },
  "guiding-bolt": { category: "damage-scaling", needsReview: false },
  "inflict-wounds": { category: "damage-scaling", needsReview: false },
  "arms-of-hadar": { category: "damage-scaling", needsReview: false },
  catapult: { category: "damage-scaling", needsReview: false },
  "chaos-bolt": { category: "damage-scaling", needsReview: false, notes: "Multi-type damage; scaling only affects 1d6 component" },
  "dissonant-whispers": { category: "damage-scaling", needsReview: false },
  "earth-tremor": { category: "damage-scaling", needsReview: false },
  "ensnaring-strike": { category: "damage-scaling", needsReview: false },
  "hail-of-thorns": { category: "damage-scaling", needsReview: false },
  "ice-knife": { category: "damage-scaling", needsReview: false, notes: "Only cold scales; piercing is fixed" },
  "ray-of-sickness": { category: "damage-scaling", needsReview: false },
  "searing-smite": { category: "damage-scaling", needsReview: false },
  "thunderous-smite": { category: "damage-scaling", needsReview: false },
  "witch-bolt": { category: "damage-scaling", needsReview: false },
  "wrathful-smite": { category: "damage-scaling", needsReview: false },
  "magic-missile": { category: "damage-scaling", needsReview: false, notes: "Adds darts, not dice; +1d4+1 per level" },
  "cure-wounds": { category: "healing-scaling", needsReview: false },
  "healing-word": { category: "healing-scaling", needsReview: false },
  "cloud-of-daggers": { category: "damage-scaling", needsReview: false },
  "flaming-sphere": { category: "damage-scaling", needsReview: false },
  "melfs-acid-arrow": { category: "damage-scaling", needsReview: false },
  "scorching-ray": { category: "damage-scaling", needsReview: false, notes: "Adds rays, not per-ray damage; attack roll spell" },
  shatter: { category: "damage-scaling", needsReview: false },
  "spiritual-weapon": { category: "damage-scaling", needsReview: false },
  "prayer-of-healing": { category: "healing-scaling", needsReview: false },
  fireball: { category: "damage-scaling", needsReview: false },
  "lightning-bolt": { category: "damage-scaling", needsReview: false },
  "call-lightning": { category: "damage-scaling", needsReview: false },
  "spirit-guardians": { category: "damage-scaling", needsReview: false },
  "vampiric-touch": { category: "damage-scaling", needsReview: false },
  "mass-healing-word": { category: "healing-scaling", needsReview: false },
  blight: { category: "damage-scaling", needsReview: false },
  "ice-storm": { category: "damage-scaling", needsReview: false, notes: "Only bludgeoning scales; cold is fixed" },
};
