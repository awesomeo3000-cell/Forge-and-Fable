import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb } from "@/lib/db";
import { POST as REGISTER } from "@/app/api/auth/register/route";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-auth-limit-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "auth-limit-test-secret-auth-limit-test-secret";
  process.env.REGISTRATION_CODE = "correct-code";
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.REGISTRATION_CODE;
});

function request(email: string) {
  return new Request("http://local/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify({ email, password: "long-enough-password", inviteCode: "wrong-code" }),
  });
}

describe("persistent authentication throttling", () => {
  it("blocks an IP that rotates email addresses and survives a database reopen", async () => {
    for (let index = 0; index < 10; index += 1) {
      expect((await REGISTER(request(`attacker-${index}@example.com`))).status).toBe(403);
    }
    expect((await REGISTER(request("attacker-11@example.com"))).status).toBe(429);

    closeDb();
    expect((await REGISTER(request("attacker-after-restart@example.com"))).status).toBe(429);
  });
});
