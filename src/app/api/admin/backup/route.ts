import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getDataDir } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function matchesToken(provided: string, expected: string) {
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export async function GET(request: Request) {
  const expected = process.env.BACKUP_EXPORT_TOKEN?.trim() ?? "";
  if (expected.length < 32) {
    return Response.json({ error: "Backup export is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!provided || !matchesToken(provided, expected)) {
    return Response.json({ error: "Unauthorized." }, {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }

  const source = path.join(getDataDir(), "forge.db");
  const temporary = path.join(tmpdir(), `dreamwright-backup-${randomUUID()}.db`);
  const escaped = temporary.replace(/'/g, "''");
  const db = new DatabaseSync(source);

  try {
    db.exec("PRAGMA wal_checkpoint(FULL)");
    db.exec(`VACUUM INTO '${escaped}'`);
  } finally {
    db.close();
  }

  try {
    const backup = readFileSync(temporary);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return new Response(new Uint8Array(backup), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="dreamwright-${stamp}.db"`,
        "Content-Length": String(backup.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } finally {
    rmSync(temporary, { force: true });
  }
}
