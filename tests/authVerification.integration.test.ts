import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { consumeVerificationToken, createVerificationToken } from "@/lib/verificationStore";
import { GET as VERIFY } from "@/app/api/auth/verify/route";
import { POST as RESEND } from "@/app/api/auth/resend-verification/route";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-verification-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "verification-test-secret-verification-test-secret";
  process.env.APP_URL = "https://dreamwright.example";
  delete process.env.DISABLE_EMAIL_VERIFICATION;
  getDb().prepare("INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)")
    .run("user", "Player", "player@example.com", "unused", new Date().toISOString());
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.JWT_SECRET;
  delete process.env.APP_URL;
  delete process.env.DISABLE_EMAIL_VERIFICATION;
  vi.unstubAllEnvs();
});

describe("verification security", () => {
  it("uses only the configured canonical application URL", () => {
    expect(appUrl()).toBe("https://dreamwright.example");
    process.env.APP_URL = "not a URL";
    expect(() => appUrl()).toThrow(/absolute http\(s\) URL/);
  });

  it("requires HTTPS for the production canonical URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.APP_URL = "http://dreamwright.example";
    expect(() => appUrl()).toThrow(/must use https/);
  });

  it("rotates previous verification tokens", () => {
    const first = createVerificationToken("user");
    const second = createVerificationToken("user");
    expect(consumeVerificationToken(first)).toBeNull();
    expect(consumeVerificationToken(second)).toBe("user");
  });

  it("redirects verification results to APP_URL, not the request host", async () => {
    const token = createVerificationToken("user");
    const response = await VERIFY(new Request(`https://attacker.example/api/auth/verify?token=${token}`));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://dreamwright.example/?verified=1");
  });

  it("returns a non-enumerating resend response", async () => {
    process.env.DISABLE_EMAIL_VERIFICATION = "true";
    const known = await RESEND(new Request("https://attacker.example/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ email: "player@example.com" }),
    }));
    const unknown = await RESEND(new Request("https://attacker.example/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.11" },
      body: JSON.stringify({ email: "missing@example.com" }),
    }));
    expect(await known.json()).toEqual(await unknown.json());
  });
});
