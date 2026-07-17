/**
 * Remove expired PDF import jobs and orphaned job directories (OCR plan §22).
 * The server sweeps opportunistically on every new import; this script covers
 * long-idle deployments. Run: npm run cleanup:pdf-imports
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = process.env.FORGE_VAULT_DIR?.trim() || process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim() || path.join(process.cwd(), "data");
const dbFile = path.join(dataDir, "forge.db");
const importsDir = path.join(dataDir, "imports");

if (!fs.existsSync(dbFile)) {
  console.log("No database found at", dbFile, "— nothing to clean.");
  process.exit(0);
}

const db = new DatabaseSync(dbFile);
let removed = 0;

try {
  const hasTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pdf_import_jobs'").get();
  if (hasTable) {
    const expired = db.prepare("SELECT id FROM pdf_import_jobs WHERE expires_at < ?").all(new Date().toISOString());
    for (const { id } of expired) {
      fs.rmSync(path.join(importsDir, String(id)), { recursive: true, force: true });
      db.prepare("DELETE FROM pdf_import_jobs WHERE id = ?").run(id);
      removed++;
    }
  }

  if (fs.existsSync(importsDir)) {
    for (const entry of fs.readdirSync(importsDir)) {
      if (!/^imp_[a-f0-9]{24}$/.test(entry)) continue;
      const row = hasTable ? db.prepare("SELECT id FROM pdf_import_jobs WHERE id = ?").get(entry) : undefined;
      if (!row) {
        fs.rmSync(path.join(importsDir, entry), { recursive: true, force: true });
        removed++;
      }
    }
  }
} finally {
  db.close();
}

console.log(`Removed ${removed} expired/orphaned import job(s).`);
