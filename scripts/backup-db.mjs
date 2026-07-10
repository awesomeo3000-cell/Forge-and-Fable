import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const configured = process.env.FORGE_VAULT_DIR?.trim() || process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
const dataDir = configured
  ? path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured)
  : path.join(process.cwd(), "data");
const source = path.join(dataDir, "forge.db");
const backupDir = path.join(dataDir, "backups");

if (!existsSync(source)) {
  throw new Error(`No Forge & Fable database found at ${source}`);
}

mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(backupDir, `forge-${stamp}.db`);
const escapedDestination = destination.replace(/'/g, "''");
const db = new DatabaseSync(source);

try {
  db.exec("PRAGMA wal_checkpoint(FULL)");
  db.exec(`VACUUM INTO '${escapedDestination}'`);
} finally {
  db.close();
}

const backups = readdirSync(backupDir)
  .filter((name) => /^forge-.*\.db$/.test(name))
  .sort()
  .reverse();
for (const old of backups.slice(7)) {
  rmSync(path.join(backupDir, old));
}

console.log(`Backup created: ${destination}`);
