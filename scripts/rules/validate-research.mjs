import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const researchRoot = path.join(root, "rules-research");
const sources = JSON.parse(fs.readFileSync(path.join(researchRoot, "sources.json"), "utf8"));
const sourceIds = new Set(sources.map((source) => source.id));
const inventory = JSON.parse(fs.readFileSync(path.join(researchRoot, "inventory.json"), "utf8"));
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

function validatePacket(relativePath) {
  const packet = JSON.parse(fs.readFileSync(path.join(researchRoot, relativePath), "utf8"));
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

validatePacket("2014/classes/barbarian.json");
validatePacket("2024/classes/barbarian.json");

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Research validation passed: source ledger, inventory IDs, and Barbarian pilot packets are structurally valid.");
