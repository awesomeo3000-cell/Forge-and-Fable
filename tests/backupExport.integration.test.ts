import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { closeDb } from "@/lib/db";
import { registerUser } from "@/lib/vaultStore";
import { GET as EXPORT_BACKUP } from "@/app/api/admin/backup/route";

let dataDir = "";

beforeEach(async () => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "dreamwright-backup-export-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.BACKUP_EXPORT_TOKEN = "backup-export-test-token-at-least-32-characters";
  await registerUser({ name: "Backup User", email: "backup@example.com", password: "backup-password" });
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.BACKUP_EXPORT_TOKEN;
});

describe("off-volume backup export", () => {
  it("rejects requests without the dedicated bearer token", async () => {
    const response = await EXPORT_BACKUP(new Request("http://local/api/admin/backup"));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  });

  it("returns a verified SQLite backup for the scheduled workflow", async () => {
    const response = await EXPORT_BACKUP(new Request("http://local/api/admin/backup", {
      headers: { Authorization: `Bearer ${process.env.BACKUP_EXPORT_TOKEN}` },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/vnd.sqlite3");
    expect(response.headers.get("cache-control")).toContain("no-store");

    const backupPath = path.join(dataDir, "downloaded.db");
    writeFileSync(backupPath, new Uint8Array(await response.arrayBuffer()));
    const backup = new DatabaseSync(backupPath);
    try {
      expect(backup.prepare("PRAGMA integrity_check").get()).toMatchObject({ integrity_check: "ok" });
      expect(backup.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(backup.prepare("SELECT COUNT(*) AS count FROM users").get()).toMatchObject({ count: 1 });
    } finally {
      backup.close();
    }
  });
});
