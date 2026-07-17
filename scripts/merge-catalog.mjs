import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(scriptDir, "..", "data");

const categories = [
  { file: "weapons.json", section: "Weapons & Ammo" },
  { file: "armor.json", section: "Armor & Shields" },
  { file: "adventuring-gear.json", section: "Adventuring Gear" },
  { file: "magic-items.json", section: "Magic Items" },
  { file: "spells.json", section: "Spells" },
];

const unified = {};
let totalItems = 0;

for (const { file, section } of categories) {
  const data = JSON.parse(readFileSync(resolve(dataDir, file), "utf8"));
  unified[section] = data;
  totalItems += data.length;
  console.log(`${section}: ${data.length} items`);
}

const destination = resolve(dataDir, "dnd-5e-complete-catalog.json");
writeFileSync(destination, JSON.stringify(unified, null, 2));
console.log(`Unified JSON written to ${destination} (${totalItems} total items)`);
