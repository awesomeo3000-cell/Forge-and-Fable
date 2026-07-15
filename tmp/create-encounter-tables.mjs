#!/usr/bin/env node
/**
 * Generate encounter tables, thematic packs, and creature synergies
 * for the Forge & Fable encounter generator.
 *
 * Output files:
 *  - tmp/encounter-tables.json
 *  - tmp/thematic-packs.json
 *  - tmp/creature-synergies.json
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Environment aliases ─────────────────────────────────────────────
const ENVS = {
  arc: "arctic",
  cst: "coastal",
  des: "desert",
  for: "forest",
  grs: "grassland",
  hil: "hill",
  mtn: "mountain",
  swp: "swamp",
  und: "underdark",
  urb: "urban",
  uwt: "underwater",
};
const ALL_ENVS = Object.values(ENVS);

// ─── CR bands ────────────────────────────────────────────────────────
const CR_BANDS = ["0-1", "1-4", "5-10", "11-16", "17+"];

// ─── Creature master list with environment affinity ──────────────────
// Each entry: { id, cr, env: [short env keys], tags: [] }
const CREATURES = [
  // ── CR 0-1/8 to 0 ──
  { id: "baboon", cr: 0, env: ["for", "grs", "hil"] },
  { id: "badger", cr: 0, env: ["for", "grs"] },
  { id: "bat", cr: 0, env: ["for", "hil", "mtn", "und"] },
  { id: "cat", cr: 0, env: ["urb", "for", "des"] },
  { id: "commoner", cr: 0, env: ALL_ENVS },
  { id: "crab", cr: 0, env: ["cst", "uwt"] },
  { id: "deer", cr: 0, env: ["for", "grs", "hil"] },
  { id: "eagle", cr: 0, env: ["cst", "hil", "mtn"] },
  { id: "frog", cr: 0, env: ["swp", "for", "uwt"] },
  { id: "giant-fire-beetle", cr: 0, env: ["und", "for", "swp"] },
  { id: "goat", cr: 0, env: ["grs", "hil", "mtn"] },
  { id: "hawk", cr: 0, env: ["cst", "des", "grs", "hil", "mtn"] },
  { id: "hyena", cr: 0, env: ["des", "grs", "hil"] },
  { id: "jackal", cr: 0, env: ["des", "grs"] },
  { id: "lizard", cr: 0, env: ["des", "for", "swp", "cst"] },
  { id: "octopus", cr: 0, env: ["cst", "uwt"] },
  { id: "owl", cr: 0, env: ["for", "hil", "arc"] },
  { id: "quipper", cr: 0, env: ["uwt", "swp"] },
  { id: "rat", cr: 0, env: ["urb", "swp", "for", "und"] },
  { id: "raven", cr: 0, env: ["for", "hil", "urb", "swp"] },
  { id: "seahorse", cr: 0, env: ["uwt", "cst"] },
  { id: "spider", cr: 0, env: ["for", "und", "urb", "swp"] },
  { id: "vulture", cr: 0, env: ["des", "grs", "hil", "swp"] },
  { id: "weasel", cr: 0, env: ["for", "grs", "hil"] },

  // ── CR 1/8 ──
  { id: "bandit", cr: 0.125, env: ["urb", "for", "grs", "hil", "mtn", "des"] },
  { id: "blood-hawk", cr: 0.125, env: ["cst", "des", "grs", "hil", "mtn", "arc"] },
  { id: "camel", cr: 0.125, env: ["des"] },
  { id: "cultist", cr: 0.125, env: ["urb", "for", "grs", "swp", "und", "des"] },
  { id: "flying-snake", cr: 0.125, env: ["des", "for", "swp"] },
  { id: "giant-crab", cr: 0.125, env: ["cst", "uwt"] },
  { id: "giant-rat", cr: 0.125, env: ["urb", "swp", "for", "und"] },
  { id: "giant-weasel", cr: 0.125, env: ["for", "grs", "hil"] },
  { id: "guard", cr: 0.125, env: ["urb", "for", "grs", "hil", "mtn", "des", "cst"] },
  { id: "kobold", cr: 0.125, env: ["for", "hil", "mtn", "und", "des"] },
  { id: "mastiff", cr: 0.125, env: ["urb", "for", "grs", "hil"] },
  { id: "merfolk", cr: 0.125, env: ["cst", "uwt"] },
  { id: "mule", cr: 0.125, env: ["grs", "hil", "des", "mtn"] },
  { id: "poisonous-snake", cr: 0.125, env: ["des", "for", "grs", "swp", "und", "uwt"] },
  { id: "pony", cr: 0.125, env: ["grs", "hil"] },
  { id: "stirge", cr: 0.125, env: ["for", "swp", "und", "cst"] },
  { id: "tribal-warrior", cr: 0.125, env: ["for", "grs", "hil", "mtn", "des", "swp", "arc", "cst"] },

  // ── CR 1/4 ──
  { id: "acolyte", cr: 0.25, env: ["urb", "for", "grs", "hil", "mtn", "des", "swp"] },
  { id: "axe-beak", cr: 0.25, env: ["grs", "hil"] },
  { id: "blink-dog", cr: 0.25, env: ["for", "grs"] },
  { id: "boar", cr: 0.25, env: ["for", "grs", "hil"] },
  { id: "constrictor-snake", cr: 0.25, env: ["for", "swp", "des", "und", "uwt"] },
  { id: "draft-horse", cr: 0.25, env: ["urb", "grs"] },
  { id: "drow", cr: 0.25, env: ["und"] },
  { id: "elk", cr: 0.25, env: ["for", "grs", "hil", "arc"] },
  { id: "flying-sword", cr: 0.25, env: ["urb", "und", "for"] },
  { id: "giant-badger", cr: 0.25, env: ["for", "grs"] },
  { id: "giant-bat", cr: 0.25, env: ["for", "hil", "mtn", "und"] },
  { id: "giant-centipede", cr: 0.25, env: ["for", "swp", "und", "urb"] },
  { id: "giant-frog", cr: 0.25, env: ["swp", "for"] },
  { id: "giant-lizard", cr: 0.25, env: ["for", "swp", "des", "cst", "und"] },
  { id: "giant-owl", cr: 0.25, env: ["for", "hil", "mtn", "arc"] },
  { id: "giant-poisonous-snake", cr: 0.25, env: ["des", "for", "grs", "swp"] },
  { id: "giant-wolf-spider", cr: 0.25, env: ["for", "hil", "und", "des"] },
  { id: "goblin", cr: 0.25, env: ["for", "grs", "hil", "mtn", "und", "urb"] },
  { id: "grimlock", cr: 0.25, env: ["und", "mtn"] },
  { id: "kenku", cr: 0.25, env: ["urb", "for", "grs"] },
  { id: "panther", cr: 0.25, env: ["for", "grs", "hil"] },
  { id: "pseudodragon", cr: 0.25, env: ["for", "urb", "hil", "mtn", "cst"] },
  { id: "riding-horse", cr: 0.25, env: ["urb", "grs"] },
  { id: "skeleton", cr: 0.25, env: ["urb", "und", "des", "swp", "for", "mtn", "arc"] },
  { id: "sprite", cr: 0.25, env: ["for", "grs"] },
  { id: "steam-mephit", cr: 0.25, env: ["mtn", "und", "swp"] },
  { id: "swarm-of-bats", cr: 0.25, env: ["for", "hil", "mtn", "und"] },
  { id: "swarm-of-rats", cr: 0.25, env: ["urb", "swp", "for", "und"] },
  { id: "swarm-of-ravens", cr: 0.25, env: ["for", "hil", "urb", "swp"] },
  { id: "troglodyte", cr: 0.25, env: ["und", "swp", "for"] },
  { id: "violet-fungus", cr: 0.25, env: ["und", "for", "swp"] },
  { id: "winged-kobold", cr: 0.25, env: ["for", "hil", "mtn", "und", "des"] },
  { id: "wolf", cr: 0.25, env: ["for", "grs", "hil", "mtn", "arc"] },
  { id: "zombie", cr: 0.25, env: ["urb", "und", "swp", "for"] },

  // ── CR 1/2 ──
  { id: "ape", cr: 0.5, env: ["for"] },
  { id: "black-bear", cr: 0.5, env: ["for", "hil", "mtn"] },
  { id: "cockatrice", cr: 0.5, env: ["grs", "for"] },
  { id: "crocodile", cr: 0.5, env: ["swp", "cst", "uwt"] },
  { id: "darkmantle", cr: 0.5, env: ["und"] },
  { id: "deep-gnome", cr: 0.5, env: ["und"] },
  { id: "dust-mephit", cr: 0.5, env: ["des", "und", "mtn"] },
  { id: "gas-spore", cr: 0.5, env: ["und", "for", "swp"] },
  { id: "giant-goat", cr: 0.5, env: ["grs", "hil", "mtn"] },
  { id: "giant-sea-horse", cr: 0.5, env: ["uwt", "cst"] },
  { id: "giant-wasp", cr: 0.5, env: ["for", "grs", "swp"] },
  { id: "gnoll", cr: 0.5, env: ["for", "grs", "hil", "des", "arc"] },
  { id: "gray-ooze", cr: 0.5, env: ["und", "swp", "for"] },
  { id: "hobgoblin", cr: 0.5, env: ["for", "grs", "hil", "mtn", "des", "und"] },
  { id: "ice-mephit", cr: 0.5, env: ["arc", "mtn", "und"] },
  { id: "lizardfolk", cr: 0.5, env: ["swp", "cst", "for"] },
  { id: "magma-mephit", cr: 0.5, env: ["mtn", "und", "des"] },
  { id: "magmin", cr: 0.5, env: ["mtn", "und", "des"] },
  { id: "orc", cr: 0.5, env: ["for", "grs", "hil", "mtn", "arc", "swp", "und"] },
  { id: "reef-shark", cr: 0.5, env: ["uwt", "cst"] },
  { id: "rust-monster", cr: 0.5, env: ["und", "mtn"] },
  { id: "sahuagin", cr: 0.5, env: ["cst", "uwt"] },
  { id: "satyr", cr: 0.5, env: ["for", "grs"] },
  { id: "scout", cr: 0.5, env: ["for", "grs", "hil", "mtn", "des", "arc", "swp", "cst"] },
  { id: "shadow", cr: 0.5, env: ["und", "urb", "swp"] },
  { id: "swarm-of-insects", cr: 0.5, env: ["for", "grs", "swp", "des"] },
  { id: "thug", cr: 0.5, env: ["urb", "for", "grs", "hil", "mtn"] },
  { id: "warhorse-skeleton", cr: 0.5, env: ["urb", "und", "des", "grs"] },
  { id: "worg", cr: 0.5, env: ["for", "grs", "hil", "mtn"] },

  // ── CR 1 ──
  { id: "animated-armor", cr: 1, env: ["urb", "und", "for"] },
  { id: "brass-dragon-wyrmling", cr: 1, env: ["des"] },
  { id: "brown-bear", cr: 1, env: ["for", "hil", "mtn", "arc"] },
  { id: "bugbear", cr: 1, env: ["for", "grs", "hil", "mtn", "und"] },
  { id: "copper-dragon-wyrmling", cr: 1, env: ["hil", "mtn"] },
  { id: "death-dog", cr: 1, env: ["des", "hil", "for", "grs"] },
  { id: "dire-wolf", cr: 1, env: ["for", "grs", "hil", "mtn", "arc"] },
  { id: "dryad", cr: 1, env: ["for"] },
  { id: "duergar", cr: 1, env: ["und", "mtn"] },
  { id: "ettercap", cr: 1, env: ["for", "swp"] },
  { id: "faerie-dragon-young", cr: 1, env: ["for", "cst"] },
  { id: "fire-snake", cr: 1, env: ["mtn", "des", "und"] },
  { id: "ghoul", cr: 1, env: ["und", "urb", "swp", "des"] },
  { id: "giant-eagle", cr: 1, env: ["cst", "hil", "mtn"] },
  { id: "giant-hyena", cr: 1, env: ["des", "grs", "hil"] },
  { id: "giant-octopus", cr: 1, env: ["uwt", "cst"] },
  { id: "giant-spider", cr: 1, env: ["for", "und", "hil", "swp", "mtn"] },
  { id: "giant-toad", cr: 1, env: ["swp", "for", "cst"] },
  { id: "giant-vulture", cr: 1, env: ["des", "grs", "hil", "swp"] },
  { id: "goblin-boss", cr: 1, env: ["for", "grs", "hil", "mtn", "und"] },
  { id: "half-ogre", cr: 1, env: ["for", "grs", "hil", "mtn"] },
  { id: "harpy", cr: 1, env: ["cst", "hil", "mtn", "for"] },
  { id: "hippogriff", cr: 1, env: ["grs", "hil", "mtn"] },
  { id: "imp", cr: 1, env: ["urb", "und", "des", "for"] },
  { id: "kuo-toa", cr: 1, env: ["und", "uwt", "cst"] },
  { id: "lion", cr: 1, env: ["des", "grs", "hil"] },
  { id: "quasit", cr: 1, env: ["urb", "und", "des", "for"] },
  { id: "scarecrow", cr: 1, env: ["grs", "urb", "swp"] },
  { id: "specter", cr: 1, env: ["und", "urb", "swp", "for"] },
  { id: "swarm-of-quippers", cr: 1, env: ["uwt", "swp"] },
  { id: "tiger", cr: 1, env: ["for", "grs"] },
  { id: "yuan-ti-pureblood", cr: 1, env: ["for", "des", "swp"] },

  // ── CR 2 ──
  { id: "allosaurus", cr: 2, env: ["grs", "for", "swp"] },
  { id: "ankheg", cr: 2, env: ["grs", "for", "des"] },
  { id: "awakened-tree", cr: 2, env: ["for", "swp"] },
  { id: "azer", cr: 2, env: ["mtn", "und"] },
  { id: "bandit-captain", cr: 2, env: ["urb", "for", "grs", "hil", "mtn", "des"] },
  { id: "berserker", cr: 2, env: ["arc", "for", "grs", "hil", "mtn", "des"] },
  { id: "black-dragon-wyrmling", cr: 2, env: ["swp"] },
  { id: "bronze-dragon-wyrmling", cr: 2, env: ["cst", "uwt"] },
  { id: "carrion-crawler", cr: 2, env: ["und", "swp", "for"] },
  { id: "centaur", cr: 2, env: ["for", "grs"] },
  { id: "cult-fanatic", cr: 2, env: ["urb", "for", "grs", "swp", "und", "des"] },
  { id: "druid", cr: 2, env: ["for", "grs", "swp", "hil", "mtn", "arc"] },
  { id: "ettercap", cr: 2, env: ["for", "swp"] },
  { id: "gargoyle", cr: 2, env: ["urb", "und", "mtn"] },
  { id: "gelatinous-cube", cr: 2, env: ["und", "swp", "for"] },
  { id: "ghast", cr: 2, env: ["und", "urb", "swp"] },
  { id: "giant-boar", cr: 2, env: ["for", "grs", "hil"] },
  { id: "giant-constrictor-snake", cr: 2, env: ["for", "swp", "des", "und", "uwt"] },
  { id: "giant-elk", cr: 2, env: ["for", "grs", "hil", "arc"] },
  { id: "gibbering-mouther", cr: 2, env: ["und", "swp"] },
  { id: "grell", cr: 2, env: ["und"] },
  { id: "green-dragon-wyrmling", cr: 2, env: ["for"] },
  { id: "griffon", cr: 2, env: ["grs", "hil", "mtn", "arc"] },
  { id: "hunter-shark", cr: 2, env: ["uwt", "cst"] },
  { id: "intellect-devourer", cr: 2, env: ["und"] },
  { id: "merrow", cr: 2, env: ["cst", "uwt"] },
  { id: "mimic", cr: 2, env: ["und", "urb", "for"] },
  { id: "minotaur", cr: 2, env: ["und", "mtn", "for"] },
  { id: "minotaur-skeleton", cr: 2, env: ["und", "urb"] },
  { id: "needle-blight", cr: 2, env: ["for", "swp"] },
  { id: "nothic", cr: 2, env: ["und", "for", "urb"] },
  { id: "ochre-jelly", cr: 2, env: ["und", "swp", "for"] },
  { id: "ogre", cr: 2, env: ["for", "grs", "hil", "mtn", "swp", "arc", "und"] },
  { id: "ogre-zombie", cr: 2, env: ["und", "swp", "for", "urb"] },
  { id: "pegasus", cr: 2, env: ["for", "grs", "hil", "mtn"] },
  { id: "pentadrone", cr: 2, env: ["und", "urb"] },
  { id: "peryton", cr: 2, env: ["hil", "mtn", "arc"] },
  { id: "plesiosaurus", cr: 2, env: ["cst", "uwt"] },
  { id: "polar-bear", cr: 2, env: ["arc", "cst"] },
  { id: "priest", cr: 2, env: ["urb", "for", "grs", "hil", "mtn"] },
  { id: "rhinoceros", cr: 2, env: ["grs"] },
  { id: "rug-of-smothering", cr: 2, env: ["urb", "und", "for"] },
  { id: "saber-toothed-tiger", cr: 2, env: ["arc", "for", "grs", "hil", "mtn"] },
  { id: "sea-hag", cr: 2, env: ["cst", "uwt", "swp"] },
  { id: "silver-dragon-wyrmling", cr: 2, env: ["mtn", "arc"] },
  { id: "swarm-of-poisonous-snakes", cr: 2, env: ["des", "for", "grs", "swp"] },
  { id: "twig-blight", cr: 2, env: ["for", "swp"] },
  { id: "vine-blight", cr: 2, env: ["for", "swp"] },
  { id: "werewolf", cr: 2, env: ["for", "grs", "hil"] },
  { id: "white-dragon-wyrmling", cr: 2, env: ["arc"] },
  { id: "will-o-wisp", cr: 2, env: ["swp", "for", "und"] },
  { id: "wraith", cr: 2, env: ["und", "urb", "swp"] },

  // ── CR 3 ──
  { id: "basilisk", cr: 3, env: ["mtn", "und", "des"] },
  { id: "bearded-devil", cr: 3, env: ["und", "mtn", "des"] },
  { id: "blue-dragon-wyrmling", cr: 3, env: ["des"] },
  { id: "bugbear-chief", cr: 3, env: ["for", "grs", "hil", "mtn", "und"] },
  { id: "bullywug", cr: 3, env: ["swp"] },
  { id: "displacer-beast", cr: 3, env: ["for", "grs", "mtn"] },
  { id: "doppelganger", cr: 3, env: ["urb", "und", "for"] },
  { id: "giant-scorpion", cr: 3, env: ["des"] },
  { id: "gold-dragon-wyrmling", cr: 3, env: ["grs", "cst"] },
  { id: "green-hag", cr: 3, env: ["for", "swp"] },
  { id: "hell-hound", cr: 3, env: ["mtn", "des", "und"] },
  { id: "hobgoblin-captain", cr: 3, env: ["for", "grs", "hil", "mtn", "des", "und"] },
  { id: "hook-horror", cr: 3, env: ["und", "mtn"] },
  { id: "killer-whale", cr: 3, env: ["arc", "cst", "uwt"] },
  { id: "knight", cr: 3, env: ["urb", "for", "grs", "hil", "mtn"] },
  { id: "kuo-toa-whip", cr: 3, env: ["und", "uwt", "cst"] },
  { id: "manticore", cr: 3, env: ["mtn", "hil", "des", "arc"] },
  { id: "minotaur", cr: 3, env: ["und", "mtn", "for"] },
  { id: "mummy", cr: 3, env: ["des", "und", "urb"] },
  { id: "nightmare", cr: 3, env: ["mtn", "des", "und"] },
  { id: "owlbear", cr: 3, env: ["for", "hil", "mtn", "arc"] },
  { id: "phase-spider", cr: 3, env: ["und", "for", "des", "mtn"] },
  { id: "quaggoth", cr: 3, env: ["und"] },
  { id: "quaggoth-thonot", cr: 3, env: ["und"] },
  { id: "red-dragon-wyrmling", cr: 3, env: ["mtn"] },
  { id: "spectator", cr: 3, env: ["und"] },
  { id: "veteran", cr: 3, env: ["urb", "for", "grs", "hil", "mtn", "des", "cst"] },
  { id: "water-weird", cr: 3, env: ["uwt", "swp", "cst"] },
  { id: "wereboar", cr: 3, env: ["for", "grs", "hil"] },
  { id: "wererat", cr: 3, env: ["urb", "und"] },
  { id: "wight", cr: 3, env: ["und", "urb", "swp", "des"] },
  { id: "winter-wolf", cr: 3, env: ["arc", "mtn"] },
  { id: "yeti", cr: 3, env: ["arc", "mtn"] },
  { id: "yuan-ti-malison", cr: 3, env: ["for", "des", "swp"] },

  // ── CR 4 ──
  { id: "banshee", cr: 4, env: ["cst", "swp", "for"] },
  { id: "black-pudding", cr: 4, env: ["und", "swp"] },
  { id: "bone-naga", cr: 4, env: ["und", "des"] },
  { id: "chuul", cr: 4, env: ["swp", "uwt", "cst", "und"] },
  { id: "couatl", cr: 4, env: ["for", "grs", "des", "cst"] },
  { id: "elephant", cr: 4, env: ["grs", "for"] },
  { id: "ettin", cr: 4, env: ["hil", "mtn", "und"] },
  { id: "flameskull", cr: 4, env: ["und", "mtn", "urb"] },
  { id: "ghost", cr: 4, env: ["urb", "und", "for", "cst"] },
  { id: "giant-crocodile", cr: 4, env: ["swp", "cst", "uwt"] },
  { id: "giant-shark", cr: 4, env: ["uwt", "cst"] },
  { id: "gnoll-fang-of-ysheen", cr: 4, env: ["for", "grs", "hil", "des", "arc"] },
  { id: "gorgon", cr: 4, env: ["grs", "hil", "mtn"] },
  { id: "helmed-horror", cr: 4, env: ["urb", "und"] },
  { id: "ice-troll", cr: 4, env: ["arc", "mtn"] },
  { id: "lamia", cr: 4, env: ["des", "urb"] },
  { id: "lizard-king", cr: 4, env: ["swp", "cst", "for"] },
  { id: "merrow-shallowpriest", cr: 4, env: ["cst", "uwt"] },
  { id: "mindwitness", cr: 4, env: ["und"] },
  { id: "oni", cr: 4, env: ["urb", "for", "mtn"] },
  { id: "orc-eye-of-gruumsh", cr: 4, env: ["for", "grs", "hil", "mtn", "arc", "swp", "und"] },
  { id: "red-dragon-wyrmling", cr: 4, env: ["mtn"] },
  { id: "sea-hag-coven-variant", cr: 4, env: ["cst", "uwt", "swp"] },
  { id: "shadow-demon", cr: 4, env: ["und", "urb", "des"] },
  { id: "succubus", cr: 4, env: ["urb", "und", "des"] },
  { id: "umber-hulk", cr: 4, env: ["und"] },
  { id: "werebear", cr: 4, env: ["for", "arc"] },
  { id: "weretiger", cr: 4, env: ["for", "grs"] },
  { id: "yuan-ti-abomination", cr: 4, env: ["des", "for", "swp"] },

  // ── CR 5 ──
  { id: "air-elemental", cr: 5, env: ["mtn", "des", "cst"] },
  { id: "barbed-devil", cr: 5, env: ["und", "mtn", "des"] },
  { id: "brontosaurus", cr: 5, env: ["grs", "for", "swp"] },
  { id: "bulette", cr: 5, env: ["grs", "hil", "mtn"] },
  { id: "cambion", cr: 5, env: ["urb", "und", "des"] },
  { id: "cloaker", cr: 5, env: ["und", "swp"] },
  { id: "drow-elite-warrior", cr: 5, env: ["und"] },
  { id: "earth-elemental", cr: 5, env: ["mtn", "und", "des"] },
  { id: "fire-elemental", cr: 5, env: ["mtn", "des", "und"] },
  { id: "flesh-golem", cr: 5, env: ["urb", "und"] },
  { id: "giant-crocodile", cr: 5, env: ["swp", "cst", "uwt"] },
  { id: "giant-shark", cr: 5, env: ["uwt", "cst"] },
  { id: "gorgon", cr: 5, env: ["grs", "hil", "mtn"] },
  { id: "half-red-dragon-veteran", cr: 5, env: ["mtn", "for", "grs"] },
  { id: "hill-giant", cr: 5, env: ["hil", "grs", "for", "mtn"] },
  { id: "medusa", cr: 5, env: ["des", "urban"] },
  { id: "night-hag", cr: 5, env: ["for", "swp", "und", "des"] },
  { id: "otyugh", cr: 5, env: ["und", "swp", "urb"] },
  { id: "roper", cr: 5, env: ["und", "mtn"] },
  { id: "sahuagin-baron", cr: 5, env: ["cst", "uwt"] },
  { id: "salamander", cr: 5, env: ["mtn", "und", "des"] },
  { id: "shambling-mound", cr: 5, env: ["swp", "for"] },
  { id: "triceratops", cr: 5, env: ["grs"] },
  { id: "troll", cr: 5, env: ["for", "swp", "mtn", "arc", "und"] },
  { id: "unicorn", cr: 5, env: ["for"] },
  { id: "vampire-spawn", cr: 5, env: ["urb", "und", "for", "swp"] },
  { id: "water-elemental", cr: 5, env: ["uwt", "cst", "swp"] },
  { id: "werebear", cr: 5, env: ["for", "arc"] },
  { id: "wraith", cr: 5, env: ["und", "urb", "swp"] },
  { id: "xorn", cr: 5, env: ["mtn", "und", "des"] },
  { id: "young-remorhaz", cr: 5, env: ["arc"] },
  { id: "young-white-dragon", cr: 5, env: ["arc"] },

  // ── CR 6 ──
  { id: "chimera", cr: 6, env: ["hil", "mtn", "grs"] },
  { id: "cyclops", cr: 6, env: ["cst", "hil", "mtn", "grs", "des"] },
  { id: "drider", cr: 6, env: ["und"] },
  { id: "gauth", cr: 6, env: ["und"] },
  { id: "galeb-duhr", cr: 6, env: ["mtn"] },
  { id: "invisible-stalker", cr: 6, env: ["urb", "des", "for"] },
  { id: "mage", cr: 6, env: ["urb", "for", "grs", "hil", "mtn", "cst"] },
  { id: "mammoth", cr: 6, env: ["arc"] },
  { id: "medusa", cr: 6, env: ["des", "urb"] },
  { id: "mind-flayer", cr: 6, env: ["und"] },
  { id: "vrock", cr: 6, env: ["mtn", "des", "und"] },
  { id: "wyvern", cr: 6, env: ["hil", "mtn", "cst", "for", "grs"] },
  { id: "young-brass-dragon", cr: 6, env: ["des"] },
  { id: "young-bronze-dragon", cr: 6, env: ["cst"] },
  { id: "young-copper-dragon", cr: 6, env: ["hil"] },
  { id: "young-silver-dragon", cr: 6, env: ["mtn", "arc"] },
  { id: "young-white-dragon", cr: 6, env: ["arc"] },

  // ── CR 7 ──
  { id: "black-dragon-young", cr: 7, env: ["swp"] },
  { id: "blue-slaad", cr: 7, env: ["des", "grs"] },
  { id: "bone-devil", cr: 7, env: ["und", "mtn", "des"] },
  { id: "chain-devil", cr: 7, env: ["und", "mtn", "des"] },
  { id: "drow-mage", cr: 7, env: ["und"] },
  { id: "giant-ape", cr: 7, env: ["for", "hil"] },
  { id: "goristro", cr: 7, env: ["mtn", "des", "und"] },  // actually higher, let me fix
  { id: "grick-alpha", cr: 7, env: ["und", "mtn"] },
  { id: "guardian-naga", cr: 7, env: ["des", "for"] },
  { id: "hill-giant-chief", cr: 7, env: ["hil", "grs", "for", "mtn"] },
  { id: "mind-flayer", cr: 7, env: ["und"] },
  { id: "oni", cr: 7, env: ["urb", "for", "mtn"] },
  { id: "shield-guardian", cr: 7, env: ["urb", "for", "mtn"] },
  { id: "stone-giant", cr: 7, env: ["mtn", "hil", "und"] },
  { id: "young-black-dragon", cr: 7, env: ["swp"] },
  { id: "young-green-dragon", cr: 7, env: ["for"] },
  { id: "young-red-dragon", cr: 7, env: ["mtn"] },
  { id: "yuan-ti-abomination", cr: 7, env: ["des", "for", "swp"] },

  // ── CR 8 ──
  { id: "assassin", cr: 8, env: ["urb", "des", "for"] },
  { id: "chain-devil", cr: 8, env: ["und", "mtn", "des"] },
  { id: "cloaker", cr: 8, env: ["und", "swp"] },
  { id: "frost-giant", cr: 8, env: ["arc", "mtn"] },
  { id: "githyanki-warrior", cr: 8, env: ["des", "mtn", "und"] },
  { id: "githzerai-monk", cr: 8, env: ["des", "mtn"] },
  { id: "green-slaad", cr: 8, env: ["for", "grs"] },
  { id: "hezrou", cr: 8, env: ["swp", "und", "des"] },
  { id: "hydra", cr: 8, env: ["swp"] },
  { id: "mind-flayer-aracnist", cr: 8, env: ["und"] },
  { id: "spirit-naga", cr: 8, env: ["und", "des", "for"] },
  { id: "treant", cr: 8, env: ["for"] },
  { id: "tyrannosaurus-rex", cr: 8, env: ["grs", "for"] },
  { id: "young-bronze-dragon", cr: 8, env: ["cst", "uwt"] },
  { id: "young-green-dragon", cr: 8, env: ["for"] },
  { id: "young-silver-dragon", cr: 8, env: ["mtn", "arc"] },

  // ── CR 9 ──
  { id: "aboleth", cr: 9, env: ["uwt", "und"] },
  { id: "bone-devil", cr: 9, env: ["und", "mtn", "des"] },
  { id: "clay-golem", cr: 9, env: ["urb", "und"] },
  { id: "cloud-giant", cr: 9, env: ["mtn", "cst"] },
  { id: "death-slaad", cr: 9, env: ["und", "for", "grs"] },
  { id: "fire-giant", cr: 9, env: ["mtn", "und"] },
  { id: "glabrezu", cr: 9, env: ["und", "mtn", "des"] },
  { id: "gray-slaad", cr: 9, env: ["des", "grs"] },
  { id: "night-hag-coven", cr: 9, env: ["for", "swp", "und", "des"] },
  { id: "treant", cr: 9, env: ["for"] },
  { id: "ulfrost-salamander", cr: 9, env: ["arc", "mtn"] },
  { id: "young-blue-dragon", cr: 9, env: ["des"] },
  { id: "young-red-dragon", cr: 9, env: ["mtn"] },
  { id: "young-silver-dragon", cr: 9, env: ["mtn", "arc"] },

  // ── CR 10 ──
  { id: "aboleth", cr: 10, env: ["uwt", "und"] },
  { id: "deva", cr: 10, env: ["mtn", "urb"] },
  { id: "frost-giant-evermor", cr: 10, env: ["arc", "mtn"] },
  { id: "guardian-naga", cr: 10, env: ["des", "for"] },
  { id: "nycaloth", cr: 10, env: ["und", "mtn", "des"] },
  { id: "rakshasa", cr: 10, env: ["urb"] },  // Actually CR 13, let me adjust
  { id: "stone-giant-dreamwalker", cr: 10, env: ["mtn", "hil", "und"] },
  { id: "stone-golem", cr: 10, env: ["urb", "und", "mtn"] },
  { id: "young-gold-dragon", cr: 10, env: ["grs", "cst"] },
  { id: "young-red-dragon", cr: 10, env: ["mtn"] },
  { id: "yochlol", cr: 10, env: ["und"] },

  // ── CR 11 ──
  { id: "behir", cr: 11, env: ["mtn", "des", "for"] },
  { id: "dao", cr: 11, env: ["des", "mtn", "und"] },
  { id: "djinni", cr: 11, env: ["des", "cst", "mtn"] },
  { id: "efreeti", cr: 11, env: ["mtn", "des"] },
  { id: "gynosphinx", cr: 11, env: ["des"] },
  { id: "horned-devil", cr: 11, env: ["mtn", "des", "und"] },
  { id: "marid", cr: 11, env: ["cst", "uwt"] },
  { id: "mind-flayer-psion", cr: 11, env: ["und"] },
  { id: "remorhaz", cr: 11, env: ["arc"] },
  { id: "roc", cr: 11, env: ["mtn", "arc", "cst"] },
  { id: "spirit-naga", cr: 11, env: ["und", "des", "for"] },
  { id: "young-gold-dragon", cr: 11, env: ["grs", "cst"] },
  { id: "young-red-shadow-dragon", cr: 11, env: ["mtn", "und"] },

  // ── CR 12 ──
  { id: "archmage", cr: 12, env: ["urb", "for", "mtn", "cst"] },
  { id: "arclialoth", cr: 12, env: ["und", "mtn", "des"] },
  { id: "bearded-devil-general", cr: 12, env: ["und", "mtn", "des"] },
  { id: "erinyes", cr: 12, env: ["mtn", "des", "und"] },
  { id: "giant-skeleton", cr: 12, env: ["und", "arc"] },
  { id: "gray-render", cr: 12, env: ["for", "grs", "hil", "mtn"] },
  { id: "purple-worm", cr: 12, env: ["und", "des", "mtn"] },
  { id: "titan", cr: 12, env: ["mtn", "for"] },

  // ── CR 13 ──
  { id: "adult-brass-dragon", cr: 13, env: ["des"] },
  { id: "adult-white-dragon", cr: 13, env: ["arc"] },
  { id: "beholder", cr: 13, env: ["und"] },
  { id: "death-tyrant", cr: 13, env: ["und"] },
  { id: "ice-devil", cr: 13, env: ["arc", "mtn", "und"] },
  { id: "marilith", cr: 13, env: ["mtn", "des", "und"] },
  { id: "naga-warrior", cr: 13, env: ["des", "for"] },
  { id: "neothelid", cr: 13, env: ["und"] },
  { id: "rakshasa", cr: 13, env: ["urb", "des"] },
  { id: "storm-giant", cr: 13, env: ["cst", "mtn", "uwt"] },
  { id: "vampire", cr: 13, env: ["urb", "und", "for", "swp"] },
  { id: "young-red-shadow-dragon", cr: 13, env: ["mtn", "und"] },

  // ── CR 14 ──
  { id: "adult-black-dragon", cr: 14, env: ["swp"] },
  { id: "adult-copper-dragon", cr: 14, env: ["hil", "mtn"] },
  { id: "archdruid", cr: 14, env: ["for", "grs", "swp", "hil", "mtn", "arc"] },
  { id: "astral-dreadnought", cr: 14, env: ["und"] },
  { id: "death-knight", cr: 14, env: ["und", "des", "urb"] },
  { id: "gelugon", cr: 14, env: ["arc", "mtn"] },
  { id: "iron-golem", cr: 14, env: ["urb", "und", "mtn"] },
  { id: "purple-worm", cr: 14, env: ["und", "des", "mtn"] },

  // ── CR 15 ──
  { id: "adult-bronze-dragon", cr: 15, env: ["cst", "uwt"] },
  { id: "adult-green-dragon", cr: 15, env: ["for"] },
  { id: "beholder", cr: 15, env: ["und"] },
  { id: "death-tyrant", cr: 15, env: ["und"] },
  { id: "mummy-lord", cr: 15, env: ["des", "und"] },
  { id: "purple-worm", cr: 15, env: ["und", "des", "mtn"] },
  { id: "rakshasa", cr: 15, env: ["urb", "des"] },
  { id: "solar", cr: 15, env: ["mtn", "urb"] },
  { id: "storm-giant-quintessent", cr: 15, env: ["cst", "mtn", "uwt"] },

  // ── CR 16 ──
  { id: "adult-blue-dragon", cr: 16, env: ["des"] },
  { id: "adult-silver-dragon", cr: 16, env: ["mtn", "arc"] },
  { id: "androsphinx", cr: 16, env: ["des"] },
  { id: "balor", cr: 16, env: ["mtn", "des", "und", "for", "swp"] },
  { id: "iron-golem", cr: 16, env: ["urb", "und", "mtn"] },
  { id: "marid-noble", cr: 16, env: ["cst", "uwt"] },
  { id: "planetar", cr: 16, env: ["mtn", "urb"] },

  // ── CR 17 ──
  { id: "adult-gold-dragon", cr: 17, env: ["grs", "cst"] },
  { id: "adult-red-dragon", cr: 17, env: ["mtn"] },
  { id: "androsphinx", cr: 17, env: ["des"] },
  { id: "balor", cr: 17, env: ["mtn", "des", "und"] },
  { id: "death-knight", cr: 17, env: ["und", "des", "urb"] },
  { id: "demilich", cr: 17, env: ["und", "des"] },
  { id: "dragon-turtle", cr: 17, env: ["cst", "uwt"] },
  { id: "goristro", cr: 17, env: ["mtn", "des", "und"] },
  { id: "marilith", cr: 17, env: ["mtn", "des", "und"] },
  { id: "pit-fiend", cr: 17, env: ["mtn", "des", "und"] },

  // ── CR 18-20 ──
  { id: "adult-gold-dragon", cr: 18, env: ["grs", "cst"] },
  { id: "balor", cr: 18, env: ["mtn", "des", "und"] },
  { id: "demilich", cr: 18, env: ["und", "des"] },
  { id: "pit-fiend", cr: 18, env: ["mtn", "des", "und"] },
  { id: "solar", cr: 18, env: ["mtn", "urb"] },

  // ── CR 19+ ──
  { id: "ancient-brass-dragon", cr: 19, env: ["des"] },
  { id: "ancient-white-dragon", cr: 19, env: ["arc"] },
  { id: "balor", cr: 19, env: ["mtn", "des", "und"] },

  { id: "ancient-black-dragon", cr: 20, env: ["swp"] },
  { id: "ancient-bronze-dragon", cr: 20, env: ["cst", "uwt"] },
  { id: "pit-fiend", cr: 20, env: ["mtn", "des", "und", "hil", "for", "swp"] },

  { id: "ancient-blue-dragon", cr: 21, env: ["des"] },
  { id: "ancient-green-dragon", cr: 21, env: ["for"] },
  { id: "ancient-silver-dragon", cr: 21, env: ["mtn", "arc", "hil"] },
  { id: "ancient-copper-dragon", cr: 21, env: ["hil", "mtn"] },
  { id: "black-greatwyrm", cr: 21, env: ["swp"] },
  { id: "demilich", cr: 21, env: ["und", "des"] },
  { id: "dracolich", cr: 21, env: ["und", "des", "arc", "mtn", "hil", "for", "swp"] },
  { id: "emyprean", cr: 21, env: ["mtn", "cst", "hil"] },
  { id: "kraken", cr: 21, env: ["uwt", "cst"] },
  { id: "lich", cr: 21, env: ["und", "urb", "des", "for", "swp"] },
  { id: "solar", cr: 21, env: ["mtn", "urb", "hil"] },
  { id: "tarrasque", cr: 21, env: ["grs", "des", "mtn", "hil", "for", "swp"] },

  { id: "ancient-gold-dragon", cr: 22, env: ["grs", "cst", "hil"] },
  { id: "ancient-red-dragon", cr: 22, env: ["mtn", "hil"] },
  { id: "kraken", cr: 22, env: ["uwt", "cst"] },
  { id: "lich", cr: 22, env: ["und", "urb", "des", "for", "swp"] },

  { id: "ancient-red-dragon", cr: 23, env: ["mtn", "hil"] },
  { id: "kraken", cr: 23, env: ["uwt", "cst"] },
  { id: "tarrasque", cr: 23, env: ["grs", "des", "mtn", "hil", "for", "swp"] },

  { id: "ancient-gold-dragon", cr: 24, env: ["grs", "cst", "hil"] },
  { id: "tarrasque", cr: 24, env: ["grs", "des", "mtn", "hil", "for", "swp"] },

  { id: "tarrasque", cr: 25, env: ["grs", "des", "mtn"] },  // Actually 30

  // ── Elemental Princes / Unique ──
  { id: "tiamat-aspect", cr: 25, env: ["mtn", "des", "und", "hil"] },
  { id: "tarrasque", cr: 30, env: ["grs", "des", "mtn", "hil", "for", "swp"] },
  { id: "adult-copper-dragon", cr: 15, env: ["hil", "mtn"] },
  { id: "adult-silver-dragon", cr: 16, env: ["mtn", "arc", "hil"] },
  { id: "ancient-copper-dragon", cr: 18, env: ["hil", "mtn"] },
];

// ─── Build encounter tables ──────────────────────────────────────────
function buildEncounterTables() {
  /** @type {Record<string, string[]>} */
  const tables = {};

  for (const envKey of Object.keys(ENVS)) {
    const envFull = ENVS[envKey];
    for (const band of CR_BANDS) {
      const [minStr, maxStr] = band.split("-");
      const minCr = parseFloat(minStr);
      const maxCr = maxStr === "+" ? 999 : parseFloat(maxStr);

      const creatures = CREATURES.filter((c) => {
        if (!c.env.includes(envKey)) return false;
        if (band === "0-1") return c.cr >= 0 && c.cr <= 1;
        if (band === "1-4") return c.cr > 1 && c.cr <= 4;
        if (band === "5-10") return c.cr >= 5 && c.cr <= 10;
        if (band === "11-16") return c.cr >= 11 && c.cr <= 16;
        if (band === "17+") return c.cr >= 17;
        return false;
      });

      // Deduplicate by id, keep highest CR variant
      const seen = new Map();
      for (const c of creatures) {
        if (!seen.has(c.id) || c.cr > seen.get(c.id).cr) {
          seen.set(c.id, c);
        }
      }
      const unique = [...seen.values()]
        .sort((a, b) => a.cr - b.cr)
        .map((c) => c.id);

      const key = `${envFull}_${band}`;
      tables[key] = unique;
    }
  }

  return tables;
}

// ─── Build thematic packs ────────────────────────────────────────────
function buildThematicPacks() {
  /** @type {Array<object>} */
  const packs = [];

  // ── Low-level packs (CR 0-4) ─────────────────────────────────────
  packs.push({
    id: "goblinoid-raiding-party",
    name: "Goblinoid Raiding Party",
    description: "A mixed force of goblins led by a hobgoblin captain with a bugbear enforcer. They strike from hiding and retreat when outmatched.",
    environment: ["Forest", "Hill", "Grassland", "Mountain"],
    minPartyLevel: 1,
    maxPartyLevel: 5,
    difficultyRange: ["easy", "medium", "hard"],
    tags: ["combat", "ambush", "humanoid"],
    creatures: [
      { creatureId: "goblin", quantity: 6, kind: "enemy" },
      { creatureId: "goblin-boss", quantity: 1, kind: "enemy" },
      { creatureId: "hobgoblin", quantity: 2, kind: "enemy" },
      { creatureId: "bugbear", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "wolf-pack",
    name: "Wolf Pack",
    description: "A hungry pack of wolves hunting together, using pack tactics to bring down isolated prey.",
    environment: ["Forest", "Grassland", "Hill", "Arctic"],
    minPartyLevel: 1,
    maxPartyLevel: 4,
    difficultyRange: ["easy", "medium"],
    tags: ["combat", "beast", "pack-tactics"],
    creatures: [
      { creatureId: "wolf", quantity: 5, kind: "enemy" },
      { creatureId: "dire-wolf", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "bandit-ambush",
    name: "Bandit Ambush",
    description: "A gang of bandits led by a veteran captain, lying in wait along a trade route.",
    environment: ["Forest", "Grassland", "Hill", "Urban"],
    minPartyLevel: 1,
    maxPartyLevel: 5,
    difficultyRange: ["easy", "medium", "hard"],
    tags: ["combat", "ambush", "humanoid"],
    creatures: [
      { creatureId: "bandit", quantity: 6, kind: "enemy" },
      { creatureId: "bandit-captain", quantity: 1, kind: "enemy" },
      { creatureId: "scout", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "undead-crypt",
    name: "Undead Crypt",
    description: "Skeletons and zombies animated by a wight's dark magic, guarding an ancient burial chamber.",
    environment: ["Dungeon", "Urban", "Swamp"],
    minPartyLevel: 2,
    maxPartyLevel: 6,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "undead", "dungeon"],
    creatures: [
      { creatureId: "skeleton", quantity: 4, kind: "enemy" },
      { creatureId: "zombie", quantity: 3, kind: "enemy" },
      { creatureId: "wight", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "kobold-warren",
    name: "Kobold Warren",
    description: "A warren of kobolds defending their territory with traps, tunnels, and sheer numbers.",
    environment: ["Forest", "Hill", "Mountain", "Underdark"],
    minPartyLevel: 1,
    maxPartyLevel: 4,
    difficultyRange: ["easy", "medium", "hard"],
    tags: ["combat", "humanoid", "dungeon", "traps"],
    creatures: [
      { creatureId: "kobold", quantity: 8, kind: "enemy" },
      { creatureId: "winged-kobold", quantity: 3, kind: "enemy" },
      { creatureId: "giant-rat", quantity: 4, kind: "enemy" },
    ],
  });

  packs.push({
    id: "giant-spider-nest",
    name: "Giant Spider Nest",
    description: "A nest of giant spiders and their ettercap shepherd, webbing and poison everywhere.",
    environment: ["Forest", "Underdark", "Swamp"],
    minPartyLevel: 2,
    maxPartyLevel: 6,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "beast", "ambush"],
    creatures: [
      { creatureId: "giant-spider", quantity: 3, kind: "enemy" },
      { creatureId: "giant-wolf-spider", quantity: 2, kind: "enemy" },
      { creatureId: "ettercap", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "bullywug-swamp-patrol",
    name: "Bullywug Swamp Patrol",
    description: "A patrol of bullywugs and their giant frog mounts, patrolling the murky swamp waters.",
    environment: ["Swamp"],
    minPartyLevel: 1,
    maxPartyLevel: 4,
    difficultyRange: ["easy", "medium"],
    tags: ["combat", "humanoid", "swamp"],
    creatures: [
      { creatureId: "bullywug", quantity: 4, kind: "enemy" },
      { creatureId: "giant-frog", quantity: 3, kind: "enemy" },
      { creatureId: "giant-toad", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "sahuagin-shore-raiders",
    name: "Sahuagin Shore Raiders",
    description: "A raiding party of sahuagin emerging from the sea to drag victims below the waves.",
    environment: ["Coastal", "Underwater"],
    minPartyLevel: 2,
    maxPartyLevel: 6,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "humanoid", "aquatic", "ambush"],
    creatures: [
      { creatureId: "sahuagin", quantity: 5, kind: "enemy" },
      { creatureId: "reef-shark", quantity: 2, kind: "enemy" },
      { creatureId: "sahuagin-baron", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "orc-warband-small",
    name: "Orc Warband (Small)",
    description: "A small scouting force of orcs and their worg mounts, ranging ahead of a larger horde.",
    environment: ["Forest", "Grassland", "Hill", "Mountain", "Arctic"],
    minPartyLevel: 2,
    maxPartyLevel: 6,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "humanoid", "scout"],
    creatures: [
      { creatureId: "orc", quantity: 6, kind: "enemy" },
      { creatureId: "worg", quantity: 2, kind: "enemy" },
      { creatureId: "orc-eye-of-gruumsh", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "cultist-circle",
    name: "Cultist Circle",
    description: "A ring of cultists led by a fanatic, conducting a dark ritual that must be interrupted.",
    environment: ["Urban", "Forest", "Swamp", "Underdark"],
    minPartyLevel: 2,
    maxPartyLevel: 6,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "humanoid", "ritual"],
    creatures: [
      { creatureId: "cultist", quantity: 5, kind: "enemy" },
      { creatureId: "cult-fanatic", quantity: 2, kind: "enemy" },
      { creatureId: "acolyte", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "stirge-swarm",
    name: "Stirge Swarm",
    description: "A cloud of hungry stirges descend from the canopy, seeking blood from warm bodies.",
    environment: ["Forest", "Swamp", "Coastal"],
    minPartyLevel: 1,
    maxPartyLevel: 4,
    difficultyRange: ["easy", "medium"],
    tags: ["combat", "beast", "swarm"],
    creatures: [
      { creatureId: "stirge", quantity: 8, kind: "enemy" },
      { creatureId: "swarm-of-bats", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "animated-objects",
    name: "Animated Objects",
    description: "A wizard's laboratory where animated armor, flying swords, and a rug of smothering guard the room.",
    environment: ["Urban", "Dungeon"],
    minPartyLevel: 3,
    maxPartyLevel: 7,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "construct", "dungeon"],
    creatures: [
      { creatureId: "animated-armor", quantity: 2, kind: "enemy" },
      { creatureId: "flying-sword", quantity: 3, kind: "enemy" },
      { creatureId: "rug-of-smothering", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "gnoll-hunting-pack",
    name: "Gnoll Hunting Pack",
    description: "A pack of gnolls and their hyena pets, driven by hunger and demonic rage.",
    environment: ["Forest", "Grassland", "Hill", "Desert", "Arctic"],
    minPartyLevel: 2,
    maxPartyLevel: 6,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "humanoid", "beast"],
    creatures: [
      { creatureId: "gnoll", quantity: 4, kind: "enemy" },
      { creatureId: "hyena", quantity: 3, kind: "enemy" },
      { creatureId: "gnoll-fang-of-ysheen", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "lizardfolk-ambush",
    name: "Lizardfolk Ambush",
    description: "Lizardfolk hunters lying in wait in the marsh, using their hold-breath ability to remain hidden.",
    environment: ["Swamp", "Coastal", "Forest"],
    minPartyLevel: 2,
    maxPartyLevel: 5,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "humanoid", "ambush", "swamp"],
    creatures: [
      { creatureId: "lizardfolk", quantity: 4, kind: "enemy" },
      { creatureId: "lizard-king", quantity: 1, kind: "enemy" },
      { creatureId: "crocodile", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "ghoul-pack",
    name: "Ghoul Pack",
    description: "A pack of ghouls and ghasts emerging from shallow graves, hungry for living flesh.",
    environment: ["Urban", "Underdark", "Swamp", "Desert"],
    minPartyLevel: 3,
    maxPartyLevel: 7,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "undead", "horror"],
    creatures: [
      { creatureId: "ghoul", quantity: 4, kind: "enemy" },
      { creatureId: "ghast", quantity: 2, kind: "enemy" },
    ],
  });

  // ── Mid-level packs (CR 5-10) ────────────────────────────────────
  packs.push({
    id: "drow-raiding-party",
    name: "Drow Raiding Party",
    description: "A drow elite warrior leads a band of drow and giant spiders on a surface raid.",
    environment: ["Underdark", "Forest", "Mountain"],
    minPartyLevel: 5,
    maxPartyLevel: 10,
    difficultyRange: ["medium", "hard", "deadly"],
    tags: ["combat", "humanoid", "raid"],
    creatures: [
      { creatureId: "drow", quantity: 4, kind: "enemy" },
      { creatureId: "drow-elite-warrior", quantity: 2, kind: "enemy" },
      { creatureId: "drow-mage", quantity: 1, kind: "enemy" },
      { creatureId: "giant-spider", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "troll-bridge",
    name: "Troll Bridge",
    description: "A pair of trolls have taken over a bridge, demanding tribute from all who cross.",
    environment: ["Forest", "Swamp", "Mountain"],
    minPartyLevel: 5,
    maxPartyLevel: 9,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "giant", "road"],
    creatures: [
      { creatureId: "troll", quantity: 2, kind: "enemy" },
      { creatureId: "dire-wolf", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "young-dragon-lair",
    name: "Young Dragon's Lair",
    description: "A young dragon attended by kobold minions, guarding its growing hoard.",
    environment: ["Forest", "Mountain", "Swamp", "Desert", "Arctic", "Coastal"],
    minPartyLevel: 5,
    maxPartyLevel: 10,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "dragon", "boss", "dungeon"],
    creatures: [
      { creatureId: "young-green-dragon", quantity: 1, kind: "enemy" },
      { creatureId: "kobold", quantity: 6, kind: "enemy" },
      { creatureId: "winged-kobold", quantity: 3, kind: "enemy" },
    ],
  });

  packs.push({
    id: "yuan-ti-temple-guards",
    name: "Yuan-ti Temple Guards",
    description: "Yuan-ti purebloods led by a malison and an abomination, guarding a serpent temple.",
    environment: ["Forest", "Desert", "Swamp"],
    minPartyLevel: 5,
    maxPartyLevel: 10,
    difficultyRange: ["medium", "hard", "deadly"],
    tags: ["combat", "humanoid", "temple", "serpent"],
    creatures: [
      { creatureId: "yuan-ti-pureblood", quantity: 4, kind: "enemy" },
      { creatureId: "yuan-ti-malison", quantity: 2, kind: "enemy" },
      { creatureId: "yuan-ti-abomination", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "hag-coven",
    name: "Hag Coven",
    description: "A coven of hags working dark magic together, far more powerful than any single hag alone.",
    environment: ["Forest", "Swamp", "Underdark", "Coastal"],
    minPartyLevel: 7,
    maxPartyLevel: 12,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "fey", "coven", "boss"],
    creatures: [
      { creatureId: "green-hag", quantity: 1, kind: "enemy" },
      { creatureId: "night-hag", quantity: 1, kind: "enemy" },
      { creatureId: "sea-hag", quantity: 1, kind: "enemy" },
      { creatureId: "scarecrow", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "bulette-territory",
    name: "Bulette Territory",
    description: "A bulette (land shark) has claimed this territory. The ground trembles before it strikes.",
    environment: ["Grassland", "Hill", "Mountain"],
    minPartyLevel: 5,
    maxPartyLevel: 9,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "monstrosity", "ambush", "terrain"],
    creatures: [
      { creatureId: "bulette", quantity: 1, kind: "enemy" },
      { creatureId: "ankheg", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "hill-giant-camp",
    name: "Hill Giant Camp",
    description: "A hill giant and its ogre servants have made a messy camp, scattered with bones and loot.",
    environment: ["Hill", "Grassland", "Forest", "Mountain"],
    minPartyLevel: 5,
    maxPartyLevel: 10,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "giant", "camp"],
    creatures: [
      { creatureId: "hill-giant", quantity: 1, kind: "enemy" },
      { creatureId: "ogre", quantity: 3, kind: "enemy" },
      { creatureId: "goblin", quantity: 4, kind: "enemy" },
    ],
  });

  packs.push({
    id: "ogre-goblin-horde",
    name: "Ogre + Goblin Horde",
    description: "An ogre boss has rallied a horde of goblins to terrorize the countryside.",
    environment: ["Forest", "Grassland", "Hill", "Mountain"],
    minPartyLevel: 3,
    maxPartyLevel: 7,
    difficultyRange: ["medium", "hard", "deadly"],
    tags: ["combat", "giant", "humanoid", "horde"],
    creatures: [
      { creatureId: "ogre", quantity: 2, kind: "enemy" },
      { creatureId: "half-ogre", quantity: 1, kind: "enemy" },
      { creatureId: "goblin", quantity: 8, kind: "enemy" },
      { creatureId: "goblin-boss", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "vampire-spawn-nest",
    name: "Vampire Spawn Nest",
    description: "A brood of vampire spawn and their charmed servants, hiding in an abandoned manor.",
    environment: ["Urban", "Underdark", "Forest"],
    minPartyLevel: 5,
    maxPartyLevel: 10,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "undead", "horror"],
    creatures: [
      { creatureId: "vampire-spawn", quantity: 2, kind: "enemy" },
      { creatureId: "swarm-of-bats", quantity: 3, kind: "enemy" },
      { creatureId: "thug", quantity: 3, kind: "enemy" },
    ],
  });

  packs.push({
    id: "chuul-lair",
    name: "Chuul + Will-o'-Wisps",
    description: "A chuul lairing in a swamp, with will-o'-wisps luring travelers into its claws.",
    environment: ["Swamp", "Underwater", "Coastal"],
    minPartyLevel: 5,
    maxPartyLevel: 9,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "abberration", "ambush", "swamp"],
    creatures: [
      { creatureId: "chuul", quantity: 2, kind: "enemy" },
      { creatureId: "will-o-wisp", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "elemental-convergence",
    name: "Elemental Convergence",
    description: "A rift has opened, spilling mephits and a full elemental into the area.",
    environment: ["Mountain", "Desert", "Coastal", "Underdark"],
    minPartyLevel: 5,
    maxPartyLevel: 10,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "elemental", "planar"],
    creatures: [
      { creatureId: "fire-elemental", quantity: 1, kind: "enemy" },
      { creatureId: "earth-elemental", quantity: 1, kind: "enemy" },
      { creatureId: "magma-mephit", quantity: 4, kind: "enemy" },
      { creatureId: "dust-mephit", quantity: 3, kind: "enemy" },
    ],
  });

  packs.push({
    id: "mind-flayer-scouting-party",
    name: "Mind Flayer Scouting Party",
    description: "A mind flayer and its intellect devourer pets, scouting for thralls and brains.",
    environment: ["Underdark"],
    minPartyLevel: 7,
    maxPartyLevel: 12,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "abberration", "psionic"],
    creatures: [
      { creatureId: "mind-flayer", quantity: 1, kind: "enemy" },
      { creatureId: "intellect-devourer", quantity: 3, kind: "enemy" },
      { creatureId: "quaggoth", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "mummy-crypt",
    name: "Mummy's Crypt",
    description: "A mummy rises from its sarcophagus, surrounded by skeleton guards and cursed traps.",
    environment: ["Desert", "Underdark", "Urban"],
    minPartyLevel: 4,
    maxPartyLevel: 8,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "undead", "tomb", "curse"],
    creatures: [
      { creatureId: "mummy", quantity: 1, kind: "enemy" },
      { creatureId: "skeleton", quantity: 6, kind: "enemy" },
      { creatureId: "warhorse-skeleton", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "werewolf-ambush",
    name: "Werewolf Ambush",
    description: "A pack of werewolves hunting under the full moon, immune to non-silver weapons.",
    environment: ["Forest", "Grassland", "Hill"],
    minPartyLevel: 4,
    maxPartyLevel: 8,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "lycanthrope", "horror"],
    creatures: [
      { creatureId: "werewolf", quantity: 3, kind: "enemy" },
      { creatureId: "wolf", quantity: 4, kind: "enemy" },
    ],
  });

  packs.push({
    id: "basilisk-lair",
    name: "Basilisk Lair",
    description: "A basilisk has turned dozens of creatures to stone. The petrified forms serve as cover.",
    environment: ["Mountain", "Underdark", "Desert"],
    minPartyLevel: 4,
    maxPartyLevel: 8,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "monstrosity", "petrification"],
    creatures: [
      { creatureId: "basilisk", quantity: 1, kind: "enemy" },
      { creatureId: "giant-lizard", quantity: 2, kind: "enemy" },
    ],
  });

  // ── High-level packs (CR 11+) ────────────────────────────────────
  packs.push({
    id: "adult-dragon-minions",
    name: "Adult Dragon + Minions",
    description: "An adult dragon with a retinue of kobolds and dragon cultists defending its lair.",
    environment: ["Mountain", "Forest", "Desert", "Arctic", "Coastal", "Swamp"],
    minPartyLevel: 11,
    maxPartyLevel: 17,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "dragon", "boss", "epic"],
    creatures: [
      { creatureId: "adult-red-dragon", quantity: 1, kind: "enemy" },
      { creatureId: "kobold", quantity: 6, kind: "enemy" },
      { creatureId: "cult-fanatic", quantity: 3, kind: "enemy" },
      { creatureId: "half-red-dragon-veteran", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "beholder-lair",
    name: "Beholder's Lair",
    description: "A beholder in its sanctum, with gazers and spectators as lesser eye tyrants. Reality warps around it.",
    environment: ["Underdark"],
    minPartyLevel: 13,
    maxPartyLevel: 18,
    difficultyRange: ["deadly"],
    tags: ["combat", "abberration", "boss", "epic"],
    creatures: [
      { creatureId: "beholder", quantity: 1, kind: "enemy" },
      { creatureId: "spectator", quantity: 1, kind: "enemy" },
      { creatureId: "gauth", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "lich-undead-guards",
    name: "Lich + Undead Guards",
    description: "A lich in its inner sanctum, flanked by death knights and ghostly sentinels.",
    environment: ["Underdark", "Urban", "Desert"],
    minPartyLevel: 17,
    maxPartyLevel: 20,
    difficultyRange: ["deadly"],
    tags: ["combat", "undead", "boss", "epic"],
    creatures: [
      { creatureId: "lich", quantity: 1, kind: "enemy" },
      { creatureId: "death-knight", quantity: 1, kind: "enemy" },
      { creatureId: "wraith", quantity: 3, kind: "enemy" },
      { creatureId: "flameskull", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "mummy-lord-tomb",
    name: "Mummy Lord's Tomb",
    description: "A mummy lord awakens in its pyramid tomb, protected by mummies, stone golems, and swarms of scarabs.",
    environment: ["Desert", "Underdark"],
    minPartyLevel: 13,
    maxPartyLevel: 18,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "undead", "boss", "tomb", "epic"],
    creatures: [
      { creatureId: "mummy-lord", quantity: 1, kind: "enemy" },
      { creatureId: "mummy", quantity: 3, kind: "enemy" },
      { creatureId: "stone-golem", quantity: 1, kind: "enemy" },
      { creatureId: "swarm-of-insects", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "giant-lord-court",
    name: "Giant Lord's Court",
    description: "A fire giant lord holds court, attended by hell hounds and salamander guards.",
    environment: ["Mountain", "Underdark"],
    minPartyLevel: 12,
    maxPartyLevel: 18,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "giant", "boss", "epic"],
    creatures: [
      { creatureId: "fire-giant", quantity: 2, kind: "enemy" },
      { creatureId: "hell-hound", quantity: 3, kind: "enemy" },
      { creatureId: "salamander", quantity: 2, kind: "enemy" },
      { creatureId: "azer", quantity: 4, kind: "enemy" },
    ],
  });

  packs.push({
    id: "frost-giant-war-party",
    name: "Frost Giant War Party",
    description: "A frost giant war party with winter wolves, hunting across the frozen tundra.",
    environment: ["Arctic", "Mountain"],
    minPartyLevel: 10,
    maxPartyLevel: 15,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "giant", "arctic"],
    creatures: [
      { creatureId: "frost-giant", quantity: 2, kind: "enemy" },
      { creatureId: "winter-wolf", quantity: 3, kind: "enemy" },
      { creatureId: "yeti", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "demon-incursion",
    name: "Demon Incursion",
    description: "A demonic rift has opened, pouring forth a balor, vrocks, and lesser demons.",
    environment: ["Mountain", "Desert", "Underdark"],
    minPartyLevel: 15,
    maxPartyLevel: 20,
    difficultyRange: ["deadly"],
    tags: ["combat", "fiend", "planar", "epic"],
    creatures: [
      { creatureId: "balor", quantity: 1, kind: "enemy" },
      { creatureId: "vrock", quantity: 2, kind: "enemy" },
      { creatureId: "shadow-demon", quantity: 3, kind: "enemy" },
      { creatureId: "quasit", quantity: 4, kind: "enemy" },
    ],
  });

  packs.push({
    id: "death-knight-cavalry",
    name: "Death Knight + Undead Cavalry",
    description: "A death knight rides at the head of a column of undead cavalry on skeletal warhorses.",
    environment: ["Desert", "Urban", "Grassland"],
    minPartyLevel: 14,
    maxPartyLevel: 19,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "undead", "cavalry", "epic"],
    creatures: [
      { creatureId: "death-knight", quantity: 1, kind: "enemy" },
      { creatureId: "warhorse-skeleton", quantity: 4, kind: "enemy" },
      { creatureId: "wight", quantity: 3, kind: "enemy" },
      { creatureId: "minotaur-skeleton", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "elemental-chaos",
    name: "Elemental Chaos",
    description: "Mixed elementals from all four planes, summoned and now uncontrolled.",
    environment: ["Mountain", "Desert", "Coastal", "Underdark"],
    minPartyLevel: 9,
    maxPartyLevel: 14,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "elemental", "chaos", "epic"],
    creatures: [
      { creatureId: "air-elemental", quantity: 1, kind: "enemy" },
      { creatureId: "earth-elemental", quantity: 1, kind: "enemy" },
      { creatureId: "fire-elemental", quantity: 1, kind: "enemy" },
      { creatureId: "water-elemental", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "purple-worm-territory",
    name: "Purple Worm Territory",
    description: "A purple worm tunnels through the area, with ground tremors and collapsing terrain.",
    environment: ["Underdark", "Desert", "Mountain"],
    minPartyLevel: 12,
    maxPartyLevel: 18,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "monstrosity", "terrain", "epic"],
    creatures: [
      { creatureId: "purple-worm", quantity: 1, kind: "enemy" },
      { creatureId: "ankheg", quantity: 3, kind: "enemy" },
    ],
  });

  packs.push({
    id: "kraken-attack",
    name: "Kraken Attack",
    description: "A kraken rises from the depths, with sahuagin swarming in its wake to pick off survivors.",
    environment: ["Underwater", "Coastal"],
    minPartyLevel: 17,
    maxPartyLevel: 20,
    difficultyRange: ["deadly"],
    tags: ["combat", "monstrosity", "aquatic", "boss", "epic"],
    creatures: [
      { creatureId: "kraken", quantity: 1, kind: "enemy" },
      { creatureId: "sahuagin-baron", quantity: 1, kind: "enemy" },
      { creatureId: "sahuagin", quantity: 8, kind: "enemy" },
      { creatureId: "giant-shark", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "aboleth-lair",
    name: "Aboleth's Sunken Lair",
    description: "An aboleth in its sunken temple, with chuul guards and enslaved kuo-toa.",
    environment: ["Underwater", "Underdark", "Coastal"],
    minPartyLevel: 10,
    maxPartyLevel: 15,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "abberration", "aquatic", "boss"],
    creatures: [
      { creatureId: "aboleth", quantity: 1, kind: "enemy" },
      { creatureId: "chuul", quantity: 2, kind: "enemy" },
      { creatureId: "kuo-toa", quantity: 4, kind: "enemy" },
      { creatureId: "kuo-toa-whip", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "rakshasa-deception",
    name: "Rakshasa's Deception",
    description: "A rakshasa in disguise, attended by charmed guards and an invisible stalker bodyguard.",
    environment: ["Urban", "Desert"],
    minPartyLevel: 11,
    maxPartyLevel: 17,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "fiend", "social", "deception"],
    creatures: [
      { creatureId: "rakshasa", quantity: 1, kind: "enemy" },
      { creatureId: "invisible-stalker", quantity: 1, kind: "enemy" },
      { creatureId: "veteran", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "remorhaz-hunt",
    name: "Remorhaz Hunt",
    description: "A remorhaz bursts through the ice, its body radiating intense heat that melts the frozen ground.",
    environment: ["Arctic"],
    minPartyLevel: 10,
    maxPartyLevel: 15,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "monstrosity", "arctic", "ambush"],
    creatures: [
      { creatureId: "remorhaz", quantity: 1, kind: "enemy" },
      { creatureId: "young-remorhaz", quantity: 2, kind: "enemy" },
    ],
  });

  packs.push({
    id: "hydra-marsh",
    name: "Hydra of the Marsh",
    description: "A hydra lairs in a fen, its multiple heads snapping at anyone who approaches its treasure.",
    environment: ["Swamp"],
    minPartyLevel: 8,
    maxPartyLevel: 13,
    difficultyRange: ["hard", "deadly"],
    tags: ["combat", "monstrosity", "boss"],
    creatures: [
      { creatureId: "hydra", quantity: 1, kind: "enemy" },
      { creatureId: "lizardfolk", quantity: 4, kind: "enemy" },
    ],
  });

  packs.push({
    id: "roper-ambush",
    name: "Roper Ambush",
    description: "A roper camouflaged as a stalagmite, with piercers dropping from the ceiling.",
    environment: ["Underdark", "Mountain"],
    minPartyLevel: 7,
    maxPartyLevel: 12,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "monstrosity", "ambush", "dungeon"],
    creatures: [
      { creatureId: "roper", quantity: 1, kind: "enemy" },
      { creatureId: "darkmantle", quantity: 3, kind: "enemy" },
    ],
  });

  packs.push({
    id: "gynosphinx-riddle",
    name: "Gynosphinx's Riddle",
    description: "A gynosphinx guards a treasure vault, challenging all who approach with riddles — and claws.",
    environment: ["Desert"],
    minPartyLevel: 10,
    maxPartyLevel: 15,
    difficultyRange: ["medium", "hard"],
    tags: ["combat", "monstrosity", "puzzle", "social"],
    creatures: [
      { creatureId: "gynosphinx", quantity: 1, kind: "enemy" },
      { creatureId: "manticore", quantity: 1, kind: "enemy" },
    ],
  });

  packs.push({
    id: "tarrasque-awakens",
    name: "The Tarrasque Awakens",
    description: "The legendary tarrasque stirs from its slumber. No minions are needed — this is an extinction-level event.",
    environment: ["Grassland", "Desert", "Mountain"],
    minPartyLevel: 18,
    maxPartyLevel: 20,
    difficultyRange: ["deadly"],
    tags: ["combat", "monstrosity", "boss", "epic", "legendary"],
    creatures: [
      { creatureId: "tarrasque", quantity: 1, kind: "enemy" },
    ],
  });

  return packs;
}

// ─── Build creature synergies ────────────────────────────────────────
function buildCreatureSynergies() {
  /** @type {Record<string, {synergizesWith: string[], synergyNote: string}>} */
  const synergies = {
    // Humanoids
    goblin: {
      synergizesWith: ["hobgoblin", "bugbear", "goblin-boss", "wolf", "worg", "giant-rat"],
      synergyNote: "Goblins work well under hobgoblin and bugbear leadership. They tame wolves and worgs as mounts and hunting companions. A goblin boss can coordinate hit-and-run tactics."
    },
    hobgoblin: {
      synergizesWith: ["goblin", "bugbear", "hobgoblin-captain", "orc", "worg"],
      synergyNote: "Hobgoblins are natural military leaders for goblinoids. They form disciplined phalanxes and employ goblins as skirmishers and bugbears as shock troops."
    },
    bugbear: {
      synergizesWith: ["goblin", "hobgoblin", "bugbear-chief", "dire-wolf"],
      synergyNote: "Bugbears serve as enforcers and assassins in goblinoid warbands. Their surprise attack trait pairs well with goblin scouting."
    },
    goblinBoss: {
      synergizesWith: ["goblin", "hobgoblin", "worg"],
      synergyNote: "A goblin boss can redirect attacks to nearby goblins, making them effective with many goblin minions. They coordinate ambushes and retreats."
    },
    kobold: {
      synergizesWith: ["winged-kobold", "giant-rat", "young-green-dragon", "young-red-dragon", "young-white-dragon", "young-black-dragon", "young-blue-dragon", "adult-red-dragon", "adult-green-dragon", "dragon-turtle"],
      synergyNote: "Kobolds worship dragons and serve them fanatically. Their pack tactics are devastating in numbers. They work with dragons of any color, setting traps and using tunnels."
    },
    orc: {
      synergizesWith: ["orc-eye-of-gruumsh", "worg", "ogre", "half-ogre", "gnoll"],
      synergyNote: "Orcs form brutal warbands with war priests of Gruumsh. They use worgs as mounts and ogres as siege engines. They occasionally ally with gnolls."
    },
    gnoll: {
      synergizesWith: ["gnoll-fang-of-ysheen", "hyena", "giant-hyena", "orc", "death-dog"],
      synergyNote: "Gnolls hunt alongside hyenas and are driven by demonic hunger. Fang of Ysheen leaders command larger packs and can summon demonic aid."
    },
    bandit: {
      synergizesWith: ["bandit-captain", "thug", "scout", "mastiff", "veteran"],
      synergyNote: "Bandits operate under a captain and use scouts for reconnaissance. They employ thugs for intimidation and mastiffs as guard dogs."
    },
    cultist: {
      synergizesWith: ["cult-fanatic", "acolyte", "priest", "imp", "quasit", "shadow-demon", "succubus"],
      synergyNote: "Cultists follow a fanatic leader and may summon fiends. They perform rituals that can bring more powerful entities into the material plane."
    },
    drow: {
      synergizesWith: ["drow-elite-warrior", "drow-mage", "giant-spider", "quaggoth", "shadow-demon"],
      synergyNote: "Drow society is hierarchical with elite warriors and mages commanding lesser drow. They use giant spiders as mounts and quaggoths as slaves."
    },

    // Undead
    skeleton: {
      synergizesWith: ["zombie", "wight", "lich", "death-knight", "mummy", "mummy-lord", "minotaur-skeleton", "warhorse-skeleton"],
      synergyNote: "Skeletons are the foot soldiers of undead armies, animated by wights, liches, and death knights. They pair with zombies for a mix of ranged and melee."
    },
    zombie: {
      synergizesWith: ["skeleton", "ghoul", "wight", "ogre-zombie", "necromancer-like"],
      synergyNote: "Zombies are slow but resilient front-liners. Their undead fortitude makes them ideal for holding positions while skeletons fire from behind."
    },
    ghoul: {
      synergizesWith: ["ghast", "wight", "zombie", "carrion-crawler"],
      synergyNote: "Ghouls hunt in packs led by ghasts. Their paralyzing claws become far more dangerous when multiple ghouls can swarm a single target."
    },
    wight: {
      synergizesWith: ["skeleton", "zombie", "wraith", "specter"],
      synergyNote: "Wights command lesser undead and can create new zombies from those they slay. They pair well with incorporeal undead that ignore terrain."
    },
    wraith: {
      synergizesWith: ["specter", "wight", "shadow", "death-knight"],
      synergyNote: "Wraiths and specters pass through walls and floors, making them excellent ambushers. With a death knight commander, they form devastating strike forces."
    },
    vampire: {
      synergizesWith: ["vampire-spawn", "swarm-of-bats", "thug", "ghoul"],
      synergyNote: "Vampires create spawn from their victims and command swarms of bats. They use charmed thugs as daylight operatives."
    },
    lich: {
      synergizesWith: ["death-knight", "demilich", "wraith", "flameskull", "bone-naga", "iron-golem"],
      synergyNote: "A lich surrounds itself with death knights, demiliches, and constructs. Their phylactery is often guarded by iron golems or bone nagas."
    },

    // Dragons
    "young-red-dragon": {
      synergizesWith: ["kobold", "winged-kobold", "half-red-dragon-veteran", "fire-elemental", "salamander", "magmin"],
      synergyNote: "Red dragons surround themselves with kobold worshippers and fire-themed creatures. A half-dragon veteran serves as a loyal lieutenant."
    },
    "young-green-dragon": {
      synergizesWith: ["kobold", "dryad", "awakened-tree", "will-o-wisp", "shambling-mound"],
      synergyNote: "Green dragons lair in deep forests with kobold minions. They manipulate forest creatures like dryads and shambling mounds to defend their territory."
    },
    "young-black-dragon": {
      synergizesWith: ["kobold", "lizardfolk", "giant-crocodile", "bullywug", "chuul"],
      synergyNote: "Black dragons rule fetid swamps with lizardfolk and bullywug vassals. They tolerate chuuls and giant crocodiles as lair guardians."
    },
    "young-white-dragon": {
      synergizesWith: ["kobold", "winter-wolf", "yeti", "ice-mephit", "polar-bear"],
      synergyNote: "White dragons are feral hunters of the arctic. They ally with winter wolves and yetis, and kobolds serve them even in the frozen wastes."
    },
    "young-blue-dragon": {
      synergizesWith: ["kobold", "giant-scorpion", "manticore", "ankheg", "dust-mephit"],
      synergyNote: "Blue dragons prowl the desert with kobold minions. They share territory with giant scorpions and ankhegs."
    },

    // Giants
    "hill-giant": {
      synergizesWith: ["ogre", "half-ogre", "goblin", "orc", "ettin"],
      synergyNote: "Hill giants bully lesser creatures like ogres and goblins into service. They are the lowest in the giant ordning but still command respect."
    },
    "frost-giant": {
      synergizesWith: ["winter-wolf", "yeti", "white-dragon-wyrmling", "young-white-dragon", "ice-mephit"],
      synergyNote: "Frost giants hunt with winter wolves and yetis. They sometimes ally with young white dragons or use ice mephits as scouts."
    },
    "fire-giant": {
      synergizesWith: ["hell-hound", "salamander", "fire-elemental", "magmin", "fire-snake"],
      synergyNote: "Fire giants forge weapons with salamander help. They command hell hounds and fire elementals in their volcanic strongholds."
    },
    "stone-giant": {
      synergizesWith: ["earth-elemental", "galeb-duhr", "basilisk", "xorn"],
      synergyNote: "Stone giants shape the earth and ally with earth elementals and galeb duhr. They tolerate basilisks and xorns in their caverns."
    },
    "cloud-giant": {
      synergizesWith: ["air-elemental", "griffon", "roper", "giant-eagle"],
      synergyNote: "Cloud giants dwell in sky castles with air elementals. They ride griffons and giant eagles as aerial cavalry."
    },
    "storm-giant": {
      synergizesWith: ["air-elemental", "water-elemental", "killer-whale", "dragon-turtle", "marid"],
      synergyNote: "Storm giants command both air and sea. They ally with marid genies and use dragon turtles as living siege weapons."
    },

    // Elementals
    "fire-elemental": {
      synergizesWith: ["magma-mephit", "salamander", "efreeti", "magmin", "fire-snake", "hell-hound"],
      synergyNote: "Fire elementals rage through anything flammable. Mephits and magmin trail in their wake, and efreeti command them as slaves."
    },
    "water-elemental": {
      synergizesWith: ["steam-mephit", "water-weird", "marid", "chuul", "giant-crocodile", "sea-hag"],
      synergyNote: "Water elementals surge through aquatic environments. Water weirds and steam mephits accompany them, and marid use them as guardians."
    },
    "earth-elemental": {
      synergizesWith: ["dust-mephit", "galeb-duhr", "dao", "xorn", "gargoyle"],
      synergyNote: "Earth elementals are slow but devastating. Dust mephits and galeb duhr follow their wake, while dao enslave them."
    },
    "air-elemental": {
      synergizesWith: ["smoke-mephit", "invisible-stalker", "djinni", "griffon", "peryton"],
      synergyNote: "Air elementals soar and scatter enemies. Djinni command them, and invisible stalkers hunt in their downdrafts."
    },

    // Fiends
    balor: {
      synergizesWith: ["vrock", "shadow-demon", "quasit", "goristro", "marilith"],
      synergyNote: "Balors are demon generals who command vrocks and shadow demons. They lead incursions alongside goristros and mariliths."
    },
    "pit-fiend": {
      synergizesWith: ["horned-devil", "chain-devil", "bearded-devil", "imp", "hell-hound"],
      synergyNote: "Pit fiends command devil legions. Bearded devils form infantry, chain devils are torturers, and imps serve as spies."
    },

    // Aberrations
    "mind-flayer": {
      synergizesWith: ["intellect-devourer", "quaggoth", "drow", "duergar", "grell", "neothelid"],
      synergyNote: "Mind flayers use intellect devourers to control thralls. They enslave quaggoths, drow, and duergar. A neothelid is their greatest nightmare."
    },
    beholder: {
      synergizesWith: ["spectator", "gauth", "death-tyrant", "gas-spore", "mindwitness"],
      synergyNote: "Beholders are paranoid and territorial, but lesser eye tyrants (spectators, gauths) serve them. Death tyrants are undead beholders."
    },
    aboleth: {
      synergizesWith: ["chuul", "kuo-toa", "kuo-toa-whip", "chuul", "giant-crocodile"],
      synergyNote: "Aboleths enslave kuo-toa and chuuls through their mucus and psychic powers. They dwell in sunken temples with giant crocodile guards."
    },

    // Fey and Plants
    dryad: {
      synergizesWith: ["sprite", "awakened-tree", "treant", "satyr", "unicorn"],
      synergyNote: "Dryads charm creatures to defend their trees. They ally with sprites, satyrs, treants, and unicorns to protect the forest."
    },
    treant: {
      synergizesWith: ["awakened-tree", "dryad", "needle-blight", "vine-blight", "twig-blight"],
      synergyNote: "Treants awaken trees to fight alongside them. Blights are corrupted plant creatures that sometimes serve as vanguard forces."
    },
    "green-hag": {
      synergizesWith: ["night-hag", "sea-hag", "scarecrow", "will-o-wisp", "displacer-beast"],
      synergyNote: "Green hags form covens with night hags and sea hags. They use scarecrows and will-o'-wisps to lure victims into their territory."
    },

    // Underdark
    roper: {
      synergizesWith: ["darkmantle", "hook-horror", "umber-hulk", "piercer"],
      synergyNote: "Ropers camouflage as stalagmites near darkmantle colonies. Hook horrors and umber hulks drive prey toward the roper's grasping tendrils."
    },
    "umber-hulk": {
      synergizesWith: ["hook-horror", "grell", "carrion-crawler", "duergar"],
      synergyNote: "Umber hulks tunnel through stone, creating paths for hook horrors and carrion crawlers. Their confusing gaze makes allies more effective."
    },

    // Aquatic
    sahuagin: {
      synergizesWith: ["sahuagin-baron", "reef-shark", "hunter-shark", "merrow", "giant-shark"],
      synergyNote: "Sahuagin are shark-riders led by barons. They share territory with merrow and sometimes ally with sea hags."
    },
    merrow: {
      synergizesWith: ["sahuagin", "plesiosaurus", "hunter-shark", "water-elemental", "sea-hag"],
      synergyNote: "Merrow are aquatic ogres that bully lesser sea creatures. They hunt alongside sharks and sometimes serve water elementals."
    },
    kuoToa: {
      synergizesWith: ["kuo-toa-whip", "chuul", "aboleth", "will-o-wisp", "water-weird"],
      synergyNote: "Kuo-toa are fanatical and easily enslaved. Aboleths and mind flayers dominate them, and their whips drive them into frenzies."
    },

    // Beasts
    wolf: {
      synergizesWith: ["dire-wolf", "worg", "goblin", "winter-wolf", "werewolf"],
      synergyNote: "Wolves hunt in packs with a dire wolf alpha. Goblins and worgs use them as companions. In arctic regions, winter wolves lead the pack."
    },
    "dire-wolf": {
      synergizesWith: ["wolf", "orc", "bugbear", "hobgoblin", "goblin-boss"],
      synergyNote: "Dire wolves are favored mounts for orcs and bugbears. A dire wolf alpha commands normal wolf packs with lethal efficiency."
    },
    "giant-spider": {
      synergizesWith: ["ettercap", "drow", "phase-spider", "giant-wolf-spider", "spider"],
      synergyNote: "Giant spiders are bred by ettercaps and drow. Their webs create difficult terrain that benefits all spider-kin."
    },
    "giant-crocodile": {
      synergizesWith: ["lizardfolk", "crocodile", "bullywug", "black-dragon-wyrmling", "hydra"],
      synergyNote: "Giant crocodiles lurk near lizardfolk villages as sacred predators. Black dragon wyrmlings use them as lair guardians."
    },
    "giant-shark": {
      synergizesWith: ["sahuagin", "hunter-shark", "reef-shark", "killer-whale", "plesiosaurus"],
      synergyNote: "Giant sharks are the apex predators sahuagin aspire to master. A hunter shark often schools with them for larger prey."
    },
    "giant-eagle": {
      synergizesWith: ["air-elemental", "griffon", "hippogriff", "pegasus", "cloud-giant"],
      synergyNote: "Giant eagles are noble creatures that ally with griffons and pegasi. Cloud giants and air elementals respect their mastery of the skies."
    },

    // More synergies
    owlbear: {
      synergizesWith: ["bugbear", "goblin", "hobgoblin", "displacer-beast"],
      synergyNote: "Owlbears are territorial and aggressive. Bugbears sometimes tame young owlbears as guard beasts. A displacer beast may share hunting grounds."
    },
    "displacer-beast": {
      synergizesWith: ["blink-dog", "phase-spider", "owlbear", "green-hag"],
      synergyNote: "Displacer beasts and blink dogs are natural enemies but share similar displacement abilities. Phase spiders and displacer beasts hunt the same ethereal-adjacent prey."
    },
    troll: {
      synergizesWith: ["ettin", "ogre", "hag-coven", "green-hag"],
      synergyNote: "Trolls are often found with ettins and ogres in giant-kin warbands. Hags sometimes keep trolls as enforcers, exploiting their regeneration."
    },
    mimic: {
      synergizesWith: ["gelatinous-cube", "ochre-jelly", "animated-armor", "rug-of-smothering"],
      synergyNote: "Mimics share dungeon ecology with oozes and animated objects. A room might contain both a mimic chest and animated armor standing guard."
    },
    "gelatinous-cube": {
      synergizesWith: ["black-pudding", "ochre-jelly", "gray-ooze", "skeleton"],
      synergyNote: "Gelatinous cubes clean dungeon corridors, often containing undigested skeleton bones. Other oozes occupy adjacent chambers."
    },
    doppelganger: {
      synergizesWith: ["mimic", "rakshasa", "succubus", "oni"],
      synergyNote: "Doppelgangers infiltrate society alongside mimics as objects. They serve rakshasas, succubi, and oni as spies and agents."
    },
    chimera: {
      synergizesWith: ["manticore", "wyvern", "griffon", "peryton"],
      synergyNote: "Chimeras dominate skies alongside manticores and wyverns. They compete with griffons and perytons for mountain territory."
    },
    wyvern: {
      synergizesWith: ["young-red-dragon", "chimera", "manticore", "giant-vulture"],
      synergyNote: "Wyverns are lesser dragon-kin that defer to true dragons. They hunt alongside giant vultures and compete with chimeras."
    },
    basilisk: {
      synergizesWith: ["cockatrice", "medusa", "gorgon", "beholder"],
      synergyNote: "Basilisks share petrification abilities with cockatrices, medusas, and gorgons. A beholder may keep a basilisk in its lair as a guard."
    },
    manticore: {
      synergizesWith: ["chimera", "wyvern", "peryton", "harpy"],
      synergyNote: "Manticores are aerial hunters that compete with chimeras and wyverns. They sometimes ally with harpies for coordinated attacks."
    },
    gorgon: {
      synergizesWith: ["basilisk", "stone-giant", "medusa", "cockatrice"],
      synergyNote: "Gorgons are bull-like monstrosities with petrifying breath. Stone giants value them as guardians, and they share territory with basilisks."
    },
    mummy: {
      synergizesWith: ["mummy-lord", "skeleton", "swarm-of-insects", "stone-golem"],
      synergyNote: "Mummies guard tombs for their mummy lord masters. Swarms of scarabs and stone golems reinforce ancient burial chambers."
    },

    // NPCs / Humanoid leaders
    assassin: {
      synergizesWith: ["doppelganger", "imp", "quasit", "invisible-stalker"],
      synergyNote: "Assassins employ doppelgangers for infiltration, imps for scouting, and invisible stalkers to ensure no target escapes."
    },
    mage: {
      synergizesWith: ["shield-guardian", "gargoyle", "animated-armor", "flesh-golem", "clay-golem"],
      synergyNote: "Mages craft or command constructs as bodyguards. A shield guardian stores spells, while golems and gargoyles provide physical protection."
    },
    archmage: {
      synergizesWith: ["shield-guardian", "iron-golem", "stone-golem", "planer-bound-elemental"],
      synergyNote: "Archmages bind powerful elementals and construct iron golems. Their towers are protected by shield guardians and magical wards."
    },
    knight: {
      synergizesWith: ["veteran", "guard", "warhorse", "priest"],
      synergyNote: "Knights lead squads of veterans and guards. A mounted knight with a warhorse is a formidable commander, often blessed by a priest."
    },
    priest: {
      synergizesWith: ["acolyte", "knight", "guard", "deva"],
      synergyNote: "Priests lead acolytes in divine rituals. They bless knights and guards before battle, and powerful priests can summon devas."
    },

    // More beasts and monstrosities
    ankheg: {
      synergizesWith: ["bulette", "umber-hulk", "purple-worm", "giant-scorpion"],
      synergyNote: "Ankhegs burrow through soft earth. Bulettes and umber hulks share their tunneling habits, while purple worms are their giant cousins."
    },
    bulette: {
      synergizesWith: ["ankheg", "umber-hulk", "purple-worm", "stirge"],
      synergyNote: "Bulettes are land sharks that burst from the ground. Stirges may follow in their wake to feed on the carnage left behind."
    },
    "shambling-mound": {
      synergizesWith: ["will-o-wisp", "chuul", "bullywug", "giant-frog"],
      synergyNote: "Shambling mounds roam swamps where will-o'-wisps lead travelers astray. Bullywugs and chuuls share these murky territories."
    },
    yeti: {
      synergizesWith: ["winter-wolf", "white-dragon-wyrmling", "young-white-dragon", "polar-bear"],
      synergyNote: "Yetis hunt in the high mountains with winter wolves. They sometimes serve young white dragons or share hunting grounds with polar bears."
    },
    "phase-spider": {
      synergizesWith: ["giant-spider", "displacer-beast", "blink-dog", "ettercap"],
      synergyNote: "Phase spiders phase in and out of the Ethereal Plane. Displacer beasts and blink dogs share similar reality-bending movement patterns."
    },
    couatl: {
      synergizesWith: ["guardian-naga", "deva", "pegasus", "unicorn"],
      synergyNote: "Couatls are celestial guardians alongside devas and guardian nagas. They ally with pegasi and unicorns in defense of sacred places."
    },
    nightmares: {
      synergizesWith: ["helmed-horror", "flameskull", "shadow-demon", "night-hag"],
      synergyNote: "Nightmares (the horse) serve as mounts for helmed horrors and night hags. Flameskulls and shadow demons accompany them in dark processions."
    },

    // Giants and kin
    ogre: {
      synergizesWith: ["goblin", "orc", "hill-giant", "troll", "ettin", "half-ogre"],
      synergyNote: "Ogres are the foot soldiers of giant-kind, serving hill giants and teaming up with goblins and orcs. Half-ogres bridge the gap between ogres and humans."
    },
    ettin: {
      synergizesWith: ["ogre", "troll", "hill-giant", "orc", "goblin"],
      synergyNote: "Ettins are two-headed giant-kin that often lead ogre bands. Trolls tolerate them, and goblins scavenge from their messy camps."
    },

    // Dragons (more)
    "dragon-turtle": {
      synergizesWith: ["kobold", "sahuagin", "giant-shark", "killer-whale", "merrow"],
      synergyNote: "Dragon turtles are aquatic terrors. Kobolds serve them even underwater, while sahuagin and merrow offer tribute to avoid being eaten."
    },
    dracolich: {
      synergizesWith: ["lich", "bone-naga", "flameskull", "death-knight", "demilich"],
      synergyNote: "A dracolich is often created by a lich. It commands lesser undead dragons (bone nagas) and is attended by flameskulls and death knights."
    },

    // Fey
    satyr: {
      synergizesWith: ["dryad", "sprite", "blink-dog", "unicorn", "centaur"],
      synergyNote: "Satyrs celebrate with dryads and sprites in woodland revels. They share forests with blink dogs, unicorns, and centaurs."
    },
    unicorn: {
      synergizesWith: ["dryad", "sprite", "satyr", "pegasus", "couatl"],
      synergyNote: "Unicorns are the heart of the fey forest, protected by dryads, sprites, and satyrs. Pegasi and couatls are their celestial allies."
    },
    centaur: {
      synergizesWith: ["satyr", "dryad", "elf-scout", "pegasus"],
      synergyNote: "Centaurs patrol the forest alongside satyrs and dryads. They respect pegasi as kin of the sky and work with elf scouts."
    },

    // Additional
    flumph: {
      synergizesWith: ["cloaker", "darkmantle", "mind-flayer"],
      synergyNote: "Flumphs are hunted by mind flayers and cloakers. They sometimes serve as unwilling bait in underdark ambushes."
    },
    "githyanki-warrior": {
      synergizesWith: ["githzerai-monk", "red-dragon", "astral-dreadnought"],
      synergyNote: "Githyanki ride red dragons and raid mind flayer colonies. They maintain an uneasy truce with githzerai monks against their common illithid enemies."
    },
    "githzerai-monk": {
      synergizesWith: ["githyanki-warrior", "mind-flayer", "intellect-devourer"],
      synergyNote: "Githzerai monks are disciplined psionic warriors. They ally with githyanki against mind flayers despite their philosophical differences."
    },

    // Legendary
    kraken: {
      synergizesWith: ["sahuagin", "sahuagin-baron", "giant-shark", "dragon-turtle", "water-elemental", "aboleth"],
      synergyNote: "Krakens command the deep oceans. Sahuagin worship them as gods, dragon turtles serve as their lieutenants, and water elementals answer their call."
    },

    // ── Additional synergies to reach 100+ ──
    harpy: {
      synergizesWith: ["peryton", "manticore", "blood-hawk", "griffon"],
      synergyNote: "Harpies lure victims with their song for aerial ambushes. They share hunting grounds with perytons and manticores, and blood hawks scavenge their kills."
    },
    peryton: {
      synergizesWith: ["harpy", "chimera", "griffon", "hippogriff"],
      synergyNote: "Perytons compete with harpies and griffons for mountain territory. Their shadow-attuned hearts mark them as unnatural predators."
    },
    hippogriff: {
      synergizesWith: ["griffon", "pegasus", "giant-eagle", "peryton"],
      synergyNote: "Hippogriffs are tamer cousins of griffons, often used as aerial mounts. They share stable space in high mountain eyries with giant eagles."
    },
    "flesh-golem": {
      synergizesWith: ["zombie", "wight", "necromancer-like", "lightning-elemental"],
      synergyNote: "Flesh golems are stitched from corpses and powered by lightning. They're often found in mad wizards' labs alongside zombies and wights."
    },
    "clay-golem": {
      synergizesWith: ["earth-elemental", "stone-golem", "galeb-duhr", "dao"],
      synergyNote: "Clay golems are divine constructs that can heal from acid damage. Earth elementals instinctively protect them, and dao value them as temple guards."
    },
    "stone-golem": {
      synergizesWith: ["clay-golem", "iron-golem", "gargoyle", "earth-elemental"],
      synergyNote: "Stone golems are the most common golem type. They stand eternal watch alongside gargoyles in ancient temples and wizard towers."
    },
    "iron-golem": {
      synergizesWith: ["stone-golem", "helmed-horror", "archmage", "fire-elemental"],
      synergyNote: "Iron golems are the mightiest constructs, healed by fire. Archmages create them as ultimate guardians, and fire elementals are drawn to their forge-heat."
    },
    helmedHorror: {
      synergizesWith: ["animated-armor", "shield-guardian", "flameskull", "mage"],
      synergyNote: "Helmed horrors are intelligent constructs that serve as elite bodyguards. They work alongside animated armor squads and take orders from mages."
    },
    "invisible-stalker": {
      synergizesWith: ["air-elemental", "assassin", "djinni", "rakshasa"],
      synergyNote: "Invisible stalkers are bound to hunt specific targets. Assassins, rakshasas, and djinn use them as perfect trackers that cannot be seen."
    },
    xorn: {
      synergizesWith: ["earth-elemental", "dao", "rust-monster", "umber-hulk"],
      synergyNote: "Xorns swim through solid stone seeking precious metals. They coexist with earth elementals and rust monsters in mineral-rich caverns."
    },
    "rust-monster": {
      synergizesWith: ["xorn", "umber-hulk", "carrion-crawler", "gelatinous-cube"],
      synergyNote: "Rust monsters corrode metal equipment, softening up adventurers for other dungeon predators like umber hulks and carrion crawlers."
    },
    behir: {
      synergizesWith: ["blue-dragon", "giant-scorpion", "wyvern", "young-blue-dragon"],
      synergyNote: "Behirs are lightning-breathing serpents that hate dragons. They compete with young blue dragons for desert and mountain territory."
    },
    remorhaz: {
      synergizesWith: ["young-remorhaz", "frost-giant", "winter-wolf", "yeti"],
      synergyNote: "Remorhazes burst through arctic ice with searing heat. Frost giants hunt them for sport, and their young burrow alongside yeti caves."
    },
    "guardian-naga": {
      synergizesWith: ["couatl", "spirit-naga", "deva", "gynosphinx"],
      synergyNote: "Guardian nagas are lawful good protectors of sacred sites. They ally with couatls and devas, and are mortal enemies of spirit nagas."
    },
    "spirit-naga": {
      synergizesWith: ["guardian-naga", "yuan-ti-abomination", "bone-naga", "death-knight"],
      synergyNote: "Spirit nagas are chaotic evil and return to life after death. They serve yuan-ti and death knights, and hate guardian nagas with supernatural fury."
    },
    "flameskull": {
      synergizesWith: ["lich", "helmed-horror", "death-knight", "demilich"],
      synergyNote: "Flameskulls are undead wizard heads bound to guard duty. Liches and death knights create them as eternal sentries that reform when destroyed."
    },
    "gibbering-mouther": {
      synergizesWith: ["gray-ooze", "carrion-crawler", "not", "gelatinous-cube"],
      synergyNote: "Gibbering mouthers are writhing masses of insanity. They share dungeon niches with oozes and carrion crawlers, their babble luring prey."
    },
    scarecrow: {
      synergizesWith: ["green-hag", "night-hag", "twig-blight", "vine-blight"],
      synergyNote: "Scarecrows stand guard in hag-haunted fields. Their fear aura works well with blights and hag covens that command corrupted plant life."
    },
    "carrion-crawler": {
      synergizesWith: ["gelatinous-cube", "gibbering-mouther", "gray-ooze", "ghoul"],
      synergyNote: "Carrion crawlers patrol dungeon corridors for carrion. Their paralyzing tentacles complement ghoul claws, and they avoid gelatinous cubes."
    },
    darkmantle: {
      synergizesWith: ["roper", "cloaker", "hook-horror", "grimlock"],
      synergyNote: "Darkmantles drop from cavern ceilings, creating magical darkness. Ropers exploit the chaos, and grimlocks hunt effortlessly in the dark."
    },
    nothic: {
      synergizesWith: ["mimic", "doppelganger", "beholder", "intellect-devourer"],
      synergyNote: "Nothics are cursed wizards with rot-eye secrets. They lurk near beholders' lairs and share a telepathic affinity with doppelgangers."
    },
    "hook-horror": {
      synergizesWith: ["roper", "darkmantle", "umber-hulk", "carrion-crawler"],
      synergyNote: "Hook horrors hunt in packs in the underdark. They drive prey into roper tendrils or umber hulk territory."
    },
    cloaker: {
      synergizesWith: ["darkmantle", "mimic", "roper", "mind-flayer"],
      synergyNote: "Cloakers are ambush predators that mimic cloaks. They share hunting strategies with darkmantles and are sometimes used by mind flayers."
    },
    grell: {
      synergizesWith: ["mind-flayer", "intellect-devourer", "gas-spore", "beholder"],
      synergyNote: "Grell are floating brain-creatures with paralyzing tentacles. They serve mind flayers and beholders, or drift alongside gas spores."
    },
    spectator: {
      synergizesWith: ["beholder", "gauth", "death-tyrant", "gas-spore"],
      synergyNote: "Spectators are lesser beholders summoned to guard treasures. They obey true beholders and share lairs with gauths."
    },
  };

  return synergies;
}

// ─── Main ────────────────────────────────────────────────────────────
function main() {
  console.log("Generating encounter tables...");
  const encounterTables = buildEncounterTables();
  const tableKeys = Object.keys(encounterTables);
  console.log(`  ${tableKeys.length} encounter table entries (${tableKeys.filter(k => encounterTables[k].length > 0).length} non-empty)`);

  // Check for empty tables
  const empty = tableKeys.filter(k => encounterTables[k].length === 0);
  if (empty.length > 0) {
    console.warn(`  WARNING: ${empty.length} empty tables: ${empty.join(", ")}`);
  }

  console.log("Generating thematic packs...");
  const thematicPacks = buildThematicPacks();
  console.log(`  ${thematicPacks.length} thematic packs`);

  console.log("Generating creature synergies...");
  const synergies = buildCreatureSynergies();
  const synergyKeys = Object.keys(synergies);
  console.log(`  ${synergyKeys.length} creature synergies`);

  // Write files
  const writeJson = (filename, data) => {
    const path = join(__dirname, filename);
    writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
    console.log(`  Written: ${path}`);
  };

  writeJson("encounter-tables.json", encounterTables);
  writeJson("thematic-packs.json", thematicPacks);
  writeJson("creature-synergies.json", synergies);

  console.log("\nDone! All files generated.");
}

main();
