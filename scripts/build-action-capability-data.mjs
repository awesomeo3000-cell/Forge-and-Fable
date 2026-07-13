import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const auditDir = path.join(root, "docs", "action-capability-audit");
const output = path.join(root, "src", "data", "actionCapabilities.json");

const inputNames = [
  "universal-2014.json",
  ...fs.readdirSync(auditDir).filter((name) => /^class-.+\.json$/.test(name)).sort(),
  "feats.json",
];

const records = inputNames.flatMap((name) => {
  const rows = JSON.parse(fs.readFileSync(path.join(auditDir, name), "utf8"));
  if (!Array.isArray(rows)) throw new Error(`${name} must contain a JSON array.`);
  return rows;
}).filter((row) => row.classification !== "needs-review").map((row) => ({
  id: row.auditId,
  name: row.name,
  sourceKind: row.sourceKind,
  sourceId: row.sourceId,
  ...(row.subclassId ? { subclassId: row.subclassId } : {}),
  minimumLevel: row.minimumLevel,
  activation: row.classification,
  ...(row.trigger ? { trigger: row.trigger } : {}),
  ...(row.resource ? { resourceId: row.resource } : {}),
  ...(row.resourceCostSummary ? { resourceCostSummary: row.resourceCostSummary } : {}),
  ...(row.rechargeSummary ? { rechargeSummary: row.rechargeSummary } : {}),
  ...(row.scalingSummary ? { scalingSummary: row.scalingSummary } : {}),
  resolutionKind: row.resolutionKind,
  summary: row.mechanicalSummary,
}));

const ids = new Set();
for (const record of records) {
  if (ids.has(record.id)) throw new Error(`Duplicate capability id: ${record.id}`);
  ids.add(record.id);
}

fs.writeFileSync(output, `${JSON.stringify(records, null, 2)}\n`);
console.log(`Wrote ${records.length} action capability records to ${path.relative(root, output)}.`);
