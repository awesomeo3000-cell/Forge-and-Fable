import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const researchRoot = path.join(root, "rules-research");
const sources = JSON.parse(fs.readFileSync(path.join(researchRoot, "sources.json"), "utf8"));
const sourceIds = new Set(sources.map((source) => source.id));
const inventory = JSON.parse(fs.readFileSync(path.join(researchRoot, "inventory.json"), "utf8"));
const subclassInventory = JSON.parse(fs.readFileSync(path.join(researchRoot, "subclasses/inventory.json"), "utf8"));
const detailedSubclassPackets = [
  "subclasses/2014/basic-rules.json",
  "subclasses/2014/remaining.json",
  "subclasses/2024/basic-rules.json",
];
const errors = [];

for (const source of sources) {
  if (!source.id || !source.ruleset || !source.title || !source.licenseScope || !source.verifiedAt) {
    errors.push(`Invalid source record: ${JSON.stringify(source)}`);
  }
}

const inventoryIds = new Set();
for (const entry of inventory.classes ?? []) {
  if (inventoryIds.has(entry.id)) errors.push(`Duplicate inventory ID: ${entry.id}`);
  inventoryIds.add(entry.id);
  if (!sourceIds.has(entry.sourceId)) errors.push(`${entry.id} references missing source ${entry.sourceId}`);
}

const classById = new Map((inventory.classes ?? []).map((entry) => [entry.id, entry]));
const subclassIds = new Set();
for (const entry of subclassInventory.records ?? []) {
  if (subclassIds.has(entry.id)) errors.push(`Duplicate subclass inventory ID: ${entry.id}`);
  subclassIds.add(entry.id);
  if (!sourceIds.has(entry.sourceId)) errors.push(`${entry.id} references missing source ${entry.sourceId}`);
  const baseClass = classById.get(entry.classId);
  if (!baseClass) errors.push(`${entry.id} references missing class packet ${entry.classId}`);
  if (baseClass && baseClass.ruleset !== entry.ruleset) errors.push(`${entry.id} ruleset does not match ${entry.classId}`);
  if (!Array.isArray(entry.featureLevels) || entry.featureLevels.length === 0 || entry.featureLevels.some((level) => !Number.isInteger(level) || level < 1 || level > 20)) {
    errors.push(`${entry.id} has invalid feature levels`);
  }
  if (Array.isArray(entry.featureLevels) && entry.featureLevels.some((level, index) => index > 0 && level <= entry.featureLevels[index - 1])) {
    errors.push(`${entry.id} feature levels are not strictly increasing`);
  }
}

const subclassInventoryById = new Map((subclassInventory.records ?? []).map((entry) => [entry.id, entry]));
let detailedSubclassCount = 0;
const detailedSubclassIds = new Set();
for (const relativePath of detailedSubclassPackets) {
  const packetFile = path.join(researchRoot, relativePath);
  const packetSet = JSON.parse(fs.readFileSync(packetFile, "utf8"));
  if (!packetSet.ruleset || !sourceIds.has(packetSet.sourceId) || !Array.isArray(packetSet.records)) {
    errors.push(`${relativePath} is missing packet-set metadata`);
    continue;
  }
  for (const packet of packetSet.records) {
    detailedSubclassCount += 1;
    if (detailedSubclassIds.has(packet.id)) errors.push(`Duplicate detailed subclass packet ID: ${packet.id}`);
    detailedSubclassIds.add(packet.id);
    const inventoryEntry = subclassInventoryById.get(packet.id);
    if (!inventoryEntry) errors.push(`${relativePath} references unlisted subclass ${packet.id}`);
    if (packet.sourceId && !sourceIds.has(packet.sourceId)) errors.push(`${packet.id} references missing packet source ${packet.sourceId}`);
    if (inventoryEntry && packet.sourceId && inventoryEntry.sourceId !== packet.sourceId) errors.push(`${packet.id} packet source does not match inventory source`);
    if (packet.ruleset && packet.ruleset !== packetSet.ruleset) errors.push(`${packet.id} has a mismatched ruleset`);
    if (!packet.classId || !classById.has(packet.classId)) errors.push(`${packet.id} references missing class packet ${packet.classId}`);
    if (inventoryEntry && inventoryEntry.ruleset !== packetSet.ruleset) errors.push(`${packet.id} ruleset does not match inventory`);
    if (!Array.isArray(packet.featureLevels) || packet.featureLevels.length === 0) {
      errors.push(`${packet.id} has no detailed feature levels`);
      continue;
    }
    const expectedLevels = inventoryEntry?.featureLevels ?? [];
    if (JSON.stringify(packet.featureLevels.map((feature) => feature.level)) !== JSON.stringify(expectedLevels)) {
      errors.push(`${packet.id} detailed feature levels do not match inventory`);
    }
    for (const feature of packet.featureLevels) {
      if (!Number.isInteger(feature.level) || feature.level < 1 || feature.level > 20) errors.push(`${packet.id} has invalid feature level`);
      if (!Array.isArray(feature.automaticFeatures) || feature.automaticFeatures.length === 0) errors.push(`${packet.id} level ${feature.level} has no automatic feature IDs`);
      if (!Array.isArray(feature.choices) || !Array.isArray(feature.resourceChanges) || !Array.isArray(feature.sourceReferences)) {
        errors.push(`${packet.id} level ${feature.level} is missing structured level-up fields`);
      }
      if (feature.sourceReferences?.some((sourceId) => !sourceIds.has(sourceId))) errors.push(`${packet.id} level ${feature.level} has an invalid source reference`);
    }
  }
}

for (const entry of subclassInventory.records ?? []) {
  if (!detailedSubclassIds.has(entry.id)) errors.push(`${entry.id} has inventory coverage but no detailed subclass packet`);
}

function validatePacket(relativePath, expectedId, expectedRuleset) {
  const packet = JSON.parse(fs.readFileSync(path.join(researchRoot, relativePath), "utf8"));
  if (packet.id !== expectedId) errors.push(`${relativePath} has unexpected packet ID ${packet.id}`);
  if (packet.ruleset !== expectedRuleset) errors.push(`${relativePath} has unexpected ruleset ${packet.ruleset}`);
  if (!packet.name || !Number.isInteger(packet.hitDie)) errors.push(`${relativePath} is missing core class metadata`);
  if (!sourceIds.has(packet.sourceId)) errors.push(`${relativePath} references missing source ${packet.sourceId}`);
  const levels = packet.levels ?? {};
  const expectedLevels = Array.from({ length: 20 }, (_, index) => String(index + 1));
  for (const key of expectedLevels) {
    const level = levels[key];
    if (!level) {
      errors.push(`${relativePath} is missing level ${key}`);
      continue;
    }
    if (level.level !== Number(key)) errors.push(`${relativePath} level key ${key} disagrees with level field`);
    if (!Number.isInteger(level.proficiencyBonus)) errors.push(`${relativePath} level ${key} has no integer proficiency bonus`);
    if (!Array.isArray(level.sourceReferences) || level.sourceReferences.some((sourceId) => !sourceIds.has(sourceId))) {
      errors.push(`${relativePath} level ${key} has an invalid source reference`);
    }
  }
}

const pilotPackets = [
  ["2014/classes/barbarian.json", "barbarian-2014", "2014"],
  ["2014/classes/bard.json", "bard-2014", "2014"],
  ["2014/classes/cleric.json", "cleric-2014", "2014"],
  ["2014/classes/druid.json", "druid-2014", "2014"],
  ["2014/classes/fighter.json", "fighter-2014", "2014"],
  ["2014/classes/paladin.json", "paladin-2014", "2014"],
  ["2014/classes/ranger.json", "ranger-2014", "2014"],
  ["2014/classes/monk.json", "monk-2014", "2014"],
  ["2014/classes/rogue.json", "rogue-2014", "2014"],
  ["2014/classes/sorcerer.json", "sorcerer-2014", "2014"],
  ["2014/classes/warlock.json", "warlock-2014", "2014"],
  ["2014/classes/wizard.json", "wizard-2014", "2014"],
  ["2014/classes/artificer.json", "artificer-2014", "2014"],
  ["2024/classes/barbarian.json", "barbarian-2024", "2024"],
  ["2024/classes/bard.json", "bard-2024", "2024"],
  ["2024/classes/cleric.json", "cleric-2024", "2024"],
  ["2024/classes/druid.json", "druid-2024", "2024"],
  ["2024/classes/fighter.json", "fighter-2024", "2024"],
  ["2024/classes/paladin.json", "paladin-2024", "2024"],
  ["2024/classes/ranger.json", "ranger-2024", "2024"],
  ["2024/classes/monk.json", "monk-2024", "2024"],
  ["2024/classes/rogue.json", "rogue-2024", "2024"],
  ["2024/classes/sorcerer.json", "sorcerer-2024", "2024"],
  ["2024/classes/warlock.json", "warlock-2024", "2024"],
  ["2024/classes/wizard.json", "wizard-2024", "2024"],
];

for (const [relativePath, expectedId, expectedRuleset] of pilotPackets) {
  validatePacket(relativePath, expectedId, expectedRuleset);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Research validation passed: source ledger, ${inventory.classes.length} class packets, ${subclassInventory.records.length} subclass inventory records, and ${detailedSubclassCount} complete detailed subclass packets are structurally valid.`);
