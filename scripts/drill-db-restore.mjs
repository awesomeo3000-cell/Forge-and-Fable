import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const input = process.argv[2]?.trim();
if (!input) {
  throw new Error("Usage: npm run db:restore-drill -- <path-to-backup.db>");
}

const source = path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
if (!existsSync(source)) throw new Error(`Backup not found at ${source}`);

const drillDir = mkdtempSync(path.join(tmpdir(), "dreamwright-restore-drill-"));
const restored = path.join(drillDir, "forge.db");

try {
  copyFileSync(source, restored);
  const db = new DatabaseSync(restored);
  try {
    db.exec("PRAGMA foreign_keys = ON");
    const integrity = String(db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "");
    if (integrity !== "ok") throw new Error(`Restored database integrity check failed: ${integrity}`);
    const foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeys.length > 0) throw new Error(`Restored database has ${foreignKeys.length} foreign-key issue(s)`);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
    const required = new Set(["users", "characters", "campaigns", "schema_migrations"]);
    for (const table of required) {
      if (!tables.some((row) => row.name === table)) throw new Error(`Restored database is missing required table: ${table}`);
    }

    db.exec("BEGIN IMMEDIATE");
    db.exec("ROLLBACK");
    const userCount = Number(db.prepare("SELECT COUNT(*) AS count FROM users").get()?.count ?? 0);
    const characterCount = Number(db.prepare("SELECT COUNT(*) AS count FROM characters").get()?.count ?? 0);
    console.log(JSON.stringify({ ok: true, userCount, characterCount, writableLock: true }, null, 2));
  } finally {
    db.close();
  }
} finally {
  rmSync(drillDir, { recursive: true, force: true });
}
