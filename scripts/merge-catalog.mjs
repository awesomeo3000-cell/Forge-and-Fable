import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "data");

const categories = [
  { file: "weapons.json", sheet: "Weapons & Ammo" },
  { file: "armor.json", sheet: "Armor & Shields" },
  { file: "adventuring-gear.json", sheet: "Adventuring Gear" },
  { file: "magic-items.json", sheet: "Magic Items" },
  { file: "spells.json", sheet: "Spells" },
];

// ── Build unified JSON ───────────────────────────────────────────────

const unified = {};

let totalItems = 0;
for (const { file, sheet } of categories) {
  const data = JSON.parse(readFileSync(`${DATA_DIR}/${file}`, "utf-8"));
  unified[sheet] = data;
  totalItems += data.length;
  console.log(`${sheet}: ${data.length} items`);
}

writeFileSync(`${DATA_DIR}/dnd-5e-complete-catalog.json`, JSON.stringify(unified, null, 2));
console.log(`\nUnified JSON written → data/dnd-5e-complete-catalog.json (${totalItems} total items)`);

// ── Build Excel workbook ──────────────────────────────────────────────

const wb = XLSX.utils.book_new();

for (const { file, sheet } of categories) {
  const data = JSON.parse(readFileSync(`${DATA_DIR}/${file}`, "utf-8"));

  // Flatten any array/object fields to strings for Excel
  const rows = data.map((item) => {
    const flat = {};
    for (const [key, val] of Object.entries(item)) {
      flat[key] = Array.isArray(val) ? val.join(", ") : typeof val === "boolean" ? val ? "Yes" : "No" : val ?? "";
    }
    return flat;
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-width columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.map((r) => String(r[key] ?? "").length).slice(0, 100)
    ) + 2,
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheet);
}

XLSX.writeFile(wb, `${DATA_DIR}/dnd-5e-complete-catalog.xlsx`);
console.log(`Excel workbook written → data/dnd-5e-complete-catalog.xlsx`);
