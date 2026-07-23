import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { createFeedback } from "@/lib/vaultStore";
import { signToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { GET } from "@/app/api/admin/feedback/route";
import { PATCH } from "@/app/api/admin/feedback/[id]/route";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-admin-feedback-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "admin-feedback-secret-admin-feedback-secret";
  process.env.ADMIN_EMAILS = "boss@example.com";
  delete process.env.RESEND_API_KEY;
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run("boss", "Boss", "boss@example.com", "unused", now);
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run("player", "Player", "player@example.com", "unused", now);
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.JWT_SECRET;
  delete process.env.ADMIN_EMAILS;
  delete process.env.RESEND_API_KEY;
});

async function cookie(userId: string) {
  const token = await signToken({ userId });
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

describe("admin feedback resolution", () => {
  it("marks feedback done, hides it from the open queue, and keeps it available in the all view", async () => {
    const feedback = await createFeedback("player", {
      category: "bug", priority: "high", title: "A reproducible issue", details: "This issue has enough detail to review.", area: "Sheet", page: "/",
    });
    const adminCookie = await cookie("boss");

    const before = await GET(new Request("http://local/api/admin/feedback", { headers: { cookie: adminCookie } }));
    expect((await before.json()).feedback).toHaveLength(1);

    const resolved = await PATCH(new Request(`http://local/api/admin/feedback/${feedback.id}`, { method: "PATCH", headers: { cookie: adminCookie } }), { params: Promise.resolve({ id: feedback.id }) });
    expect(resolved.status).toBe(200);
    expect(await resolved.json()).toMatchObject({ emailSent: false, feedback: { status: "done", resolvedBy: "boss" } });

    const after = await GET(new Request("http://local/api/admin/feedback", { headers: { cookie: adminCookie } }));
    expect((await after.json()).feedback).toHaveLength(0);
    const all = await GET(new Request("http://local/api/admin/feedback?status=all", { headers: { cookie: adminCookie } }));
    expect((await all.json()).feedback).toMatchObject([expect.objectContaining({ id: feedback.id, status: "done" })]);
  });

  it("rejects non-admin resolution attempts", async () => {
    const feedback = await createFeedback("player", {
      category: "idea", priority: "low", title: "A small idea", details: "This idea has enough detail to review.", area: "General", page: "/",
    });
    const response = await PATCH(new Request(`http://local/api/admin/feedback/${feedback.id}`, { method: "PATCH", headers: { cookie: await cookie("player") } }), { params: Promise.resolve({ id: feedback.id }) });
    expect(response.status).toBe(403);
  });
});
