import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, signToken } from "@/lib/auth";
import { getUserById, registerUser } from "@/lib/vaultStore";
import { GET as EXPORT_ACCOUNT } from "@/app/api/auth/export/route";
import { DELETE as DELETE_ACCOUNT } from "@/app/api/auth/account/route";
import { exportAccountData } from "@/lib/accountData";

let dataDir = "";
let userId = "";
let cookie = "";

beforeEach(async () => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-account-lifecycle-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "account-lifecycle-secret-account-lifecycle-secret";
  const user = await registerUser({ name: "Exporter", email: "exporter@example.com", password: "correct-password" });
  userId = user.id;
  const token = await signToken({ userId });
  cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.JWT_SECRET;
});

describe("account data lifecycle", () => {
  it("exports personal data without password hashes or tokens", async () => {
    expect(exportAccountData(userId)).toMatchObject({ account: { id: userId }, characters: [] });
    const response = await EXPORT_ACCOUNT(new Request("http://local/api/auth/export", { headers: { cookie } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({ account: { id: userId, email: "exporter@example.com" }, characters: [] });
    expect(body).not.toContain("password_hash");
    expect(body).not.toContain("verification_tokens");
  });

  it("requires password confirmation and permanently deletes the account", async () => {
    const wrong = await DELETE_ACCOUNT(new Request("http://local/api/auth/account", {
      method: "DELETE",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong-password" }),
    }));
    expect(wrong.status).toBe(403);
    expect(getUserById(userId)).toBeDefined();

    const deleted = await DELETE_ACCOUNT(new Request("http://local/api/auth/account", {
      method: "DELETE",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correct-password" }),
    }));
    expect(deleted.status).toBe(200);
    expect(deleted.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(getUserById(userId)).toBeNull();
  });
});
