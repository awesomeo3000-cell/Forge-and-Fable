import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { authenticateRequest, revokeAllSessions, SESSION_COOKIE_NAME, signToken } from "@/lib/auth";
import { consumePasswordResetToken, createPasswordResetToken } from "@/lib/passwordResetStore";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-password-reset-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "password-reset-test-secret-password-reset-test-secret";
  getDb().prepare("INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)")
    .run("user", "Player", "player@example.com", "unused", new Date().toISOString());
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.JWT_SECRET;
});

describe("password recovery and session invalidation", () => {
  it("creates a single-use reset token", () => {
    const token = createPasswordResetToken("user");
    expect(consumePasswordResetToken(token)).toBe("user");
    expect(consumePasswordResetToken(token)).toBeNull();
  });

  it("rejects a previously issued session after all sessions are revoked", async () => {
    const token = await signToken({ userId: "user" });
    const request = () => new Request("http://local/api/characters", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
    });

    await expect(authenticateRequest(request())).resolves.toBe("user");
    revokeAllSessions("user");
    await expect(authenticateRequest(request())).rejects.toThrow(/Invalid or expired token/);
  });
});
