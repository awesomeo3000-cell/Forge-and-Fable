import { readFileSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadJson(relativePath) {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf-8"));
}

// ── Load all inputs ──────────────────────────────────────────────────────────
const coreCreatures = loadJson("tmp/srd-creatures-core.json");       // Array
const featuresDict  = loadJson("tmp/srd-creature-features.json");    // { id: { traits, actions, ... } }
const environmentsDict = loadJson("tmp/srd-creature-environments.json"); // { id: [env, ...] }
const tagsDict = loadJson("tmp/srd-creature-tags.json");             // { id: [tag, ...] }
const npcTemplates = loadJson("tmp/srd-npc-templates.json");         // Array
const hazards = loadJson("tmp/srd-hazards.json");                    // Array

// ── Validate input counts ────────────────────────────────────────────────────
console.log(`Loaded ${coreCreatures.length} core creatures`);
console.log(`Loaded ${Object.keys(featuresDict).length} feature entries`);
console.log(`Loaded ${Object.keys(environmentsDict).length} environment entries`);
console.log(`Loaded ${Object.keys(tagsDict).length} tag entries`);
console.log(`Loaded ${npcTemplates.length} NPC templates`);
console.log(`Loaded ${hazards.length} hazards`);

// ── Track warnings ───────────────────────────────────────────────────────────
const warnings = [];

// ── 1. Merge core + features + environments + tags ───────────────────────────
const merged = coreCreatures.map((creature) => {
  const id = creature.id;

  // Merge features
  const features = featuresDict[id];
  if (features) {
    creature.traits           = features.traits           ?? [];
    creature.actions          = features.actions          ?? [];
    creature.bonusActions     = features.bonusActions     ?? [];
    creature.reactions        = features.reactions        ?? [];
    creature.legendaryActions = features.legendaryActions ?? [];
    creature.lairActions      = features.lairActions      ?? [];
  } else {
    warnings.push(`No features entry for "${id}"`);
    creature.traits           = creature.traits           ?? [];
    creature.actions          = creature.actions          ?? [];
    creature.bonusActions     = creature.bonusActions     ?? [];
    creature.reactions        = creature.reactions        ?? [];
    creature.legendaryActions = creature.legendaryActions ?? [];
    creature.lairActions      = creature.lairActions      ?? [];
  }

  // Merge environments
  creature.environments = environmentsDict[id] ?? creature.environments ?? [];

  // Merge tags
  creature.tags = tagsDict[id] ?? creature.tags ?? [];

  return creature;
});

console.log(`Merged ${merged.length} core creatures`);

// ── 2. Ensure default empty fields on all creatures ──────────────────────────
function ensureDefaults(creature) {
  // Array fields
  creature.traits           = creature.traits           ?? [];
  creature.actions          = creature.actions          ?? [];
  creature.bonusActions     = creature.bonusActions     ?? [];
  creature.reactions        = creature.reactions        ?? [];
  creature.legendaryActions = creature.legendaryActions ?? [];
  creature.lairActions      = creature.lairActions      ?? [];
  creature.tags             = creature.tags             ?? [];
  creature.environments     = creature.environments     ?? [];

  // String fields that core creatures set as ""
  creature.vulnerabilities      = creature.vulnerabilities      ?? "";
  creature.resistances          = creature.resistances          ?? "";
  creature.immunities           = creature.immunities           ?? "";
  creature.conditionImmunities  = creature.conditionImmunities  ?? "";
  creature.tacticsNotes         = creature.tacticsNotes         ?? "";
  creature.privateNotes         = creature.privateNotes         ?? "";
  creature.portraitUrl          = creature.portraitUrl          ?? "";
  creature.savingThrows         = creature.savingThrows         ?? "";
  creature.skills               = creature.skills               ?? "";
  creature.senses               = creature.senses               ?? "";
  creature.languages            = creature.languages            ?? "";
  creature.speed                = creature.speed                ?? "";
  creature.source               = creature.source               ?? "";

  // Ensure kind is always present
  if (!creature.kind) {
    creature.kind = "built-in";
  }

  return creature;
}

// ── 3. Add NPC templates with UUIDs ──────────────────────────────────────────
const npcsWithUuids = npcTemplates.map((tpl) => {
  ensureDefaults(tpl);
  tpl.id = randomUUID();
  // Keep a referenceSlug so we can trace back; not in the type but useful
  // Actually the type doesn't have referenceSlug, so just use the UUID as id.
  // The old ID is discarded.
  if (!tpl.createdAt) tpl.createdAt = "2025-01-01T00:00:00.000Z";
  if (!tpl.updatedAt) tpl.updatedAt = "2025-01-01T00:00:00.000Z";
  return tpl;
});

// ── 4. Add hazards with UUIDs ───────────────────────────────────────────────
const hazardsWithUuids = hazards.map((haz) => {
  ensureDefaults(haz);
  haz.id = randomUUID();
  if (!haz.createdAt) haz.createdAt = "2025-01-01T00:00:00.000Z";
  if (!haz.updatedAt) haz.updatedAt = "2025-01-01T00:00:00.000Z";
  return haz;
});

// ── 5. Combine all ───────────────────────────────────────────────────────────
const allCreatures = [...merged, ...npcsWithUuids, ...hazardsWithUuids];

console.log(`Total before validation: ${allCreatures.length}`);

// ── 6. Validation ────────────────────────────────────────────────────────────

// 6a. Check required fields
const requiredFields = ["id", "kind", "name", "armorClass", "hitPoints", "createdAt", "updatedAt"];
const missingRequired = [];
for (const c of allCreatures) {
  for (const f of requiredFields) {
    if (c[f] === undefined || c[f] === null) {
      missingRequired.push(`${c.id || "UNKNOWN"}: missing required field "${f}"`);
    }
  }
}
if (missingRequired.length > 0) {
  console.error("MISSING REQUIRED FIELDS:");
  missingRequired.forEach((m) => console.error("  " + m));
}

// 6b. Check duplicate IDs
const ids = allCreatures.map((c) => c.id);
const idCounts = {};
ids.forEach((id) => {
  idCounts[id] = (idCounts[id] || 0) + 1;
});
const duplicates = Object.entries(idCounts).filter(([, count]) => count > 1);
if (duplicates.length > 0) {
  console.error("DUPLICATE IDs:");
  duplicates.forEach(([id, count]) => console.error(`  ${id}: appears ${count} times`));
}

// 6c. Check challengeRating
const badCr = allCreatures.filter(
  (c) => c.challengeRating !== undefined && (typeof c.challengeRating !== "number" || isNaN(c.challengeRating) || c.challengeRating < 0 || c.challengeRating > 30)
);
if (badCr.length > 0) {
  console.error("INVALID challengeRating:");
  badCr.forEach((c) => console.error(`  ${c.id}: ${c.challengeRating}`));
}

// 6d. Check armorClass
const badAc = allCreatures.filter(
  (c) => typeof c.armorClass !== "number" || !Number.isInteger(c.armorClass) || c.armorClass < 0 || c.armorClass > 40
);
if (badAc.length > 0) {
  console.error("INVALID armorClass:");
  badAc.forEach((c) => console.error(`  ${c.id}: ${c.armorClass}`));
}

// 6e. Check hitPoints.average
const badHp = allCreatures.filter(
  (c) => !c.hitPoints || typeof c.hitPoints.average !== "number" || !Number.isInteger(c.hitPoints.average) || c.hitPoints.average < 1
);
if (badHp.length > 0) {
  console.error("INVALID hitPoints.average:");
  badHp.forEach((c) => console.error(`  ${c.id}: ${JSON.stringify(c.hitPoints)}`));
}

// 6f. Check abilities range
const badAbilities = allCreatures.filter((c) => {
  if (!c.abilities) return false;
  const a = c.abilities;
  const stats = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  for (const s of stats) {
    if (a[s] !== undefined && (typeof a[s] !== "number" || a[s] < 1 || a[s] > 30)) {
      return true;
    }
  }
  return false;
});
if (badAbilities.length > 0) {
  console.error("INVALID abilities (out of 1-30 range):");
  badAbilities.forEach((c) => console.error(`  ${c.id}: ${JSON.stringify(c.abilities)}`));
}

// 6g. Check kind values
const validKinds = new Set(["built-in", "template", "hazard"]);
const badKind = allCreatures.filter((c) => !validKinds.has(c.kind));
if (badKind.length > 0) {
  console.error("INVALID kind:");
  badKind.forEach((c) => console.error(`  ${c.id}: kind="${c.kind}"`));
}

// 6h. Check for 8 required built-in creatures
const required8 = ["goblin", "wolf", "skeleton", "orc", "bugbear", "ogre", "troll", "air-elemental"];
const missing8 = required8.filter((id) => !allCreatures.find((c) => c.id === id));
if (missing8.length > 0) {
  console.error("MISSING REQUIRED BUILT-IN CREATURES:");
  missing8.forEach((m) => console.error("  " + m));
}

// ── 7. Print warnings ────────────────────────────────────────────────────────
if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.forEach((w) => console.log("  " + w));
}

// ── 8. Sort creatures: built-in first, then templates, then hazards ──────────
const kindOrder = { "built-in": 0, "template": 1, "hazard": 2 };
allCreatures.sort((a, b) => {
  const ka = kindOrder[a.kind] ?? 99;
  const kb = kindOrder[b.kind] ?? 99;
  if (ka !== kb) return ka - kb;
  return a.name.localeCompare(b.name);
});

// ── 9. Summary ───────────────────────────────────────────────────────────────
const byKind = {};
const byType = {};
for (const c of allCreatures) {
  byKind[c.kind] = (byKind[c.kind] || 0) + 1;
  const t = c.creatureType || "unknown";
  byType[t] = (byType[t] || 0) + 1;
}

console.log(`\n====== FINAL SUMMARY ======`);
console.log(`Total creatures: ${allCreatures.length}`);
console.log(`\nBy kind:`);
for (const [kind, count] of Object.entries(byKind).sort()) {
  console.log(`  ${kind}: ${count}`);
}
console.log(`\nBy creatureType (top 20):`);
const sortedTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);
for (const [type, count] of sortedTypes.slice(0, 20)) {
  console.log(`  ${type}: ${count}`);
}
if (sortedTypes.length > 20) {
  console.log(`  ... and ${sortedTypes.length - 20} more types`);
}

// ── 10. Write output ─────────────────────────────────────────────────────────
const outPath = resolve(ROOT, "src", "data", "creatures.json");
writeFileSync(outPath, JSON.stringify(allCreatures, null, 2), "utf-8");
console.log(`\nWrote ${allCreatures.length} creatures to ${outPath}`);

// ── 11. Final validation: parse back to ensure valid JSON ────────────────────
try {
  const verify = JSON.parse(readFileSync(outPath, "utf-8"));
  if (!Array.isArray(verify)) throw new Error("Not an array");
  console.log(`Verified: valid JSON array with ${verify.length} entries`);
} catch (e) {
  console.error("VALIDATION FAILED on output file:", e.message);
  process.exit(1);
}
