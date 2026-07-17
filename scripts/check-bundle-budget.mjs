import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const CHUNKS_ROOT = path.join(process.cwd(), ".next", "static", "chunks");
const MAX_TOTAL_RAW_BYTES = 3.5 * 1024 * 1024;
const MAX_TOTAL_GZIP_BYTES = 1024 * 1024;
const MAX_CHUNK_RAW_BYTES = 1.5 * 1024 * 1024;
const MAX_CHUNK_GZIP_BYTES = 350 * 1024;

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return nested.flat();
}

const javascript = (await listFiles(CHUNKS_ROOT)).filter((file) => file.endsWith(".js"));
if (javascript.length === 0) {
  console.error("Bundle validation failed: no production JavaScript chunks were found. Run npm run build first.");
  process.exit(1);
}

let totalRaw = 0;
let totalGzip = 0;
const failures = [];

for (const file of javascript) {
  const raw = await readFile(file);
  const gzipBytes = gzipSync(raw).byteLength;
  const relativePath = path.relative(process.cwd(), file).replaceAll("\\", "/");
  totalRaw += raw.byteLength;
  totalGzip += gzipBytes;
  if (raw.byteLength > MAX_CHUNK_RAW_BYTES) {
    failures.push(`${relativePath} is ${(raw.byteLength / 1024).toFixed(0)} KiB raw; limit is 1536 KiB`);
  }
  if (gzipBytes > MAX_CHUNK_GZIP_BYTES) {
    failures.push(`${relativePath} is ${(gzipBytes / 1024).toFixed(0)} KiB gzip; limit is 350 KiB`);
  }
}

if (totalRaw > MAX_TOTAL_RAW_BYTES) {
  failures.push(`JavaScript chunks total ${(totalRaw / 1024 / 1024).toFixed(2)} MiB raw; limit is 3.5 MiB`);
}
if (totalGzip > MAX_TOTAL_GZIP_BYTES) {
  failures.push(`JavaScript chunks total ${(totalGzip / 1024).toFixed(0)} KiB gzip; limit is 1024 KiB`);
}

if (failures.length > 0) {
  console.error("Bundle validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Validated ${javascript.length} JavaScript chunks: ${(totalRaw / 1024 / 1024).toFixed(2)} MiB raw / ${(totalGzip / 1024).toFixed(0)} KiB gzip.`,
);
