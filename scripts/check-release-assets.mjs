import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const MAX_RUNTIME_ASSET_BYTES = 1024 * 1024;
const MAX_PUBLIC_ASSET_BYTES = 25 * 1024 * 1024;
const requiredAssets = [
  "public/backdrop.webp",
  "public/wayhouse-backdrop.webp",
  "public/forge-backdrop.webp",
  "public/Start/onboard-character.webp",
  "public/Start/onboard-campaign.webp",
];
const removedLegacyAssets = [
  "public/backdrop.png",
  "public/wayhouse-backdrop.png",
  "public/forge-backdrop.png",
  "public/Start/onboard-character.jpg",
  "public/Start/onboard-campaign.jpg",
  "public/Start/brand-seal.original.png",
  "public/Start/start-premade-spliced.webp",
  "public/portraits/generated",
];

const runtimeExtensions = new Set([
  ".avif", ".gif", ".jfif", ".jpeg", ".jpg", ".m4a", ".mp3", ".ogg",
  ".png", ".svg", ".wav", ".webm", ".webp",
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return nested.flat();
}

const failures = [];

for (const relativePath of requiredAssets) {
  const absolutePath = path.join(process.cwd(), relativePath);
  try {
    const info = await stat(absolutePath);
    if (!info.isFile()) {
      failures.push(`${relativePath} is not a file`);
    } else if (info.size > MAX_RUNTIME_ASSET_BYTES) {
      failures.push(
        `${relativePath} is ${(info.size / 1024 / 1024).toFixed(2)} MiB; limit is 1 MiB`,
      );
    }
  } catch {
    failures.push(`${relativePath} is missing`);
  }
}

const publicRoot = path.join(process.cwd(), "public");
const publicFiles = await listFiles(publicRoot);
let publicAssetBytes = 0;
let runtimeAssetCount = 0;

for (const absolutePath of publicFiles) {
  const extension = path.extname(absolutePath).toLowerCase();
  if (!runtimeExtensions.has(extension)) continue;
  const info = await stat(absolutePath);
  const relativePath = path.relative(process.cwd(), absolutePath).replaceAll("\\", "/");
  runtimeAssetCount += 1;
  publicAssetBytes += info.size;
  if (info.size > MAX_RUNTIME_ASSET_BYTES) {
    failures.push(
      `${relativePath} is ${(info.size / 1024 / 1024).toFixed(2)} MiB; per-asset limit is 1 MiB`,
    );
  }
}

if (publicAssetBytes > MAX_PUBLIC_ASSET_BYTES) {
  failures.push(
    `public runtime assets total ${(publicAssetBytes / 1024 / 1024).toFixed(2)} MiB; limit is 25 MiB`,
  );
}

for (const relativePath of removedLegacyAssets) {
  try {
    await stat(path.join(process.cwd(), relativePath));
    failures.push(`${relativePath} should be removed after WebP migration`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      failures.push(`could not inspect ${relativePath}: ${error}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Release asset validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Validated ${runtimeAssetCount} public runtime assets (${(publicAssetBytes / 1024 / 1024).toFixed(2)} MiB total; each <= 1 MiB).`,
);
