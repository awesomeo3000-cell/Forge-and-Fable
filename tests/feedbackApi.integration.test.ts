import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { createFeedback } from "@/lib/vaultStore";
import { signToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { GET } from "@/app/api/feedback/route";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-feedback-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "feedback-test-secret-feedback-test-secret";
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

async function seedUser(id: string, email: string) {
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, id, email, "unused", new Date().toISOString());
  const token = await signToken({ userId: id });
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

describe("feedback API privacy", () => {
  it("returns only feedback created by the signed-in user", async () => {
    const firstCookie = await seedUser("user-1", "first@example.com");
    await seedUser("user-2", "second@example.com");
    await createFeedback("user-1", { category: "bug", priority: "high", title: "My issue", details: "Details for the first user", area: "Sheet", page: "/" });
    await createFeedback("user-2", { category: "bug", priority: "high", title: "Private issue", details: "Details for the second user", area: "Sheet", page: "/" });

    const response = await GET(new Request("http://local/api/feedback", { headers: { cookie: firstCookie } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.feedback).toHaveLength(1);
    expect(body.feedback[0]).toMatchObject({ userId: "user-1", userEmail: "first@example.com", title: "My issue" });
  });
});
