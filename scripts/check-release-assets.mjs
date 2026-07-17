import { stat } from "node:fs/promises";
import path from "node:path";

const MAX_RUNTIME_ASSET_BYTES = 1024 * 1024;
const runtimeAssets = [
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
];

const failures = [];

for (const relativePath of runtimeAssets) {
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

console.log(`Validated ${runtimeAssets.length} release assets (each <= 1 MiB).`);
