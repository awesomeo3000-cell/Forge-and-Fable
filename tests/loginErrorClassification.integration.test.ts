import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb } from "@/lib/db";

// Keep the real InvalidCredentialsError, override only loginUser so each test
// can inject a specific failure mode.
const loginUserMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/vaultStore", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/vaultStore")>();
  return { ...actual, loginUser: loginUserMock };
});

import { InvalidCredentialsError } from "@/lib/vaultStore";
import { POST as LOGIN } from "@/app/api/auth/login/route";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-login-class-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "login-class-test-secret-login-class-test-secret";
  loginUserMock.mockReset();
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.JWT_SECRET;
});

function loginRequest(body: unknown, ip = "198.51.100.5") {
  return new Request("http://local/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("DW-004 login error classification", () => {
  it("returns 400 for a malformed request body", async () => {
    const res = await LOGIN(loginRequest("{ not json", "198.51.100.10"));
    expect(res.status).toBe(400);
  });

  it("returns 401 with a credential message for a bad password", async () => {
    loginUserMock.mockRejectedValue(new InvalidCredentialsError());
    const res = await LOGIN(loginRequest({ email: "who@example.com", password: "nope" }, "198.51.100.11"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/does not match a vault/i);
  });

  it("returns a generic 500 for an infrastructure failure without leaking the internal message", async () => {
    loginUserMock.mockRejectedValue(new Error("db exploded: secret connection string"));
    const res = await LOGIN(loginRequest({ email: "who@example.com", password: "pw" }, "198.51.100.12"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toMatch(/secret connection string/);
    expect(body.error).toMatch(/could not open vault/i);
  });

  it("does not count infrastructure failures against the login throttle", async () => {
    loginUserMock.mockRejectedValue(new Error("transient db blip"));
    const ip = "198.51.100.20";
    for (let i = 0; i < 25; i += 1) {
      const res = await LOGIN(loginRequest({ email: "victim@example.com", password: "pw" }, ip));
      expect(res.status).toBe(500); // never flips to 429
    }
    // A genuine credential attempt from the same origin is still evaluated, not throttled.
    loginUserMock.mockRejectedValue(new InvalidCredentialsError());
    const after = await LOGIN(loginRequest({ email: "victim@example.com", password: "pw" }, ip));
    expect(after.status).toBe(401);
  });

  it("still throttles repeated genuine credential failures", async () => {
    loginUserMock.mockRejectedValue(new InvalidCredentialsError());
    const ip = "198.51.100.30";
    const statuses: number[] = [];
    for (let i = 0; i < 15; i += 1) {
      statuses.push((await LOGIN(loginRequest({ email: "bruteforce@example.com", password: "pw" }, ip))).status);
    }
    expect(statuses[0]).toBe(401);
    expect(statuses).toContain(429);
  });
});
