import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { registerUser } from "@/lib/vaultStore";
import { authenticateActorRequest, authenticateRequest, signToken, SESSION_COOKIE_NAME } from "@/lib/auth";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-auth-cookie-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "auth-cookie-test-secret-auth-cookie-test-secret";
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.JWT_SECRET;
  vi.restoreAllMocks();
});

function requestWithCookie(cookie: string) {
  return new Request("http://local/api/resource", { headers: { cookie } });
}

describe("DW-009 malformed cookie handling", () => {
  it("returns a controlled 401 instead of throwing URIError on bad percent-encoding", async () => {
    const req = requestWithCookie(`${SESSION_COOKIE_NAME}=%`);
    await expect(authenticateActorRequest(req)).rejects.toMatchObject({ status: 401 });
  });
});

describe("DW-010 single actor-session verification", () => {
  it("reads session_version exactly once for a normal authenticated request", async () => {
    const user = await registerUser({ email: "solo@example.com", password: "long-enough-password" });
    const token = await signToken({ userId: user.id });

    const db = getDb();
    const prepareSpy = vi.spyOn(db, "prepare");
    const effectiveId = await authenticateRequest(requestWithCookie(`${SESSION_COOKIE_NAME}=${token}`));

    expect(effectiveId).toBe(user.id);
    const sessionVersionReads = prepareSpy.mock.calls.filter((call) => String(call[0]).includes("session_version")).length;
    expect(sessionVersionReads).toBe(1);
  });
});
