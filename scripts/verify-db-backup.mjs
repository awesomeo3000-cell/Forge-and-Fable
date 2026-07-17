import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const input = process.argv[2]?.trim();
if (!input) {
  throw new Error("Usage: npm run db:verify-backup -- <path-to-backup.db>");
}

const backupPath = path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
if (!existsSync(backupPath)) {
  throw new Error(`Backup not found at ${backupPath}`);
}

const db = new DatabaseSync(backupPath, { readOnly: true });
try {
  const integrity = db.prepare("PRAGMA integrity_check").get();
  const integrityResult = String(integrity?.integrity_check ?? "");
  if (integrityResult !== "ok") {
    throw new Error(`SQLite integrity check failed: ${integrityResult}`);
  }

  const foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
  if (foreignKeys.length > 0) {
    throw new Error(`SQLite foreign-key check failed with ${foreignKeys.length} issue(s)`);
  }

  const userVersion = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
  const userCount = Number(db.prepare("SELECT COUNT(*) AS count FROM users").get()?.count ?? 0);
  console.log(JSON.stringify({ ok: true, backupPath, userVersion, userCount }, null, 2));
} finally {
  db.close();
}
