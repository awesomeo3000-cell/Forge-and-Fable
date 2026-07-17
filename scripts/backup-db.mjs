import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const configured = process.env.FORGE_VAULT_DIR?.trim() || process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
const dataDir = configured
  ? path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured)
  : path.join(process.cwd(), "data");
const source = path.join(dataDir, "forge.db");
const configuredBackupDir = process.env.FORGE_BACKUP_DIR?.trim();
const backupDir = configuredBackupDir
  ? path.isAbsolute(configuredBackupDir)
    ? configuredBackupDir
    : path.join(process.cwd(), configuredBackupDir)
  : path.join(dataDir, "backups");
const keepCount = Math.max(1, Number.parseInt(process.env.FORGE_BACKUP_KEEP ?? "7", 10) || 7);
const allowSameVolume = process.env.FORGE_ALLOW_SAME_VOLUME_BACKUP === "true";
const backupRelativeToData = path.relative(dataDir, backupDir);
const backupInsideDataDir = backupRelativeToData === "" || (!backupRelativeToData.startsWith("..") && !path.isAbsolute(backupRelativeToData));

if (!existsSync(source)) {
  throw new Error(`No Forge & Fable database found at ${source}`);
}

mkdirSync(backupDir, { recursive: true });
if (process.env.NODE_ENV === "production" && (!configuredBackupDir || backupInsideDataDir) && !allowSameVolume) {
  throw new Error(
    "Production backups require FORGE_BACKUP_DIR outside FORGE_VAULT_DIR. " +
    "Set FORGE_ALLOW_SAME_VOLUME_BACKUP=true only when you deliberately accept that this is not disaster protection.",
  );
}
if (!configuredBackupDir || backupInsideDataDir) {
    console.warn(
      "The backup destination is on or inside the database volume; this is not disaster protection.",
    );
}
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

const backup = new DatabaseSync(destination, { readOnly: true });
try {
  const integrity = String(backup.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "");
  if (integrity !== "ok") throw new Error(`Backup integrity check failed: ${integrity}`);
  const foreignKeys = backup.prepare("PRAGMA foreign_key_check").all();
  if (foreignKeys.length > 0) throw new Error(`Backup foreign-key check failed with ${foreignKeys.length} issue(s)`);
} catch (error) {
  rmSync(destination, { force: true });
  throw error;
} finally {
  backup.close();
}

const backups = readdirSync(backupDir)
  .filter((name) => /^forge-.*\.db$/.test(name))
  .sort()
  .reverse();
for (const old of backups.slice(keepCount)) {
  rmSync(path.join(backupDir, old));
}

console.log(`Backup created: ${destination}`);
console.log("Verification: integrity and foreign-key checks passed");
console.log(`Retention: newest ${keepCount} backup${keepCount === 1 ? "" : "s"}`);
