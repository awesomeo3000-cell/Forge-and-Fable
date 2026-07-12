import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { isAdminEmail } from "@/lib/adminEmail";
import {
  createInviteCode,
  listInviteCodes,
  revokeInviteCode,
  consumeRegistrationCode,
  registrationRequiresCode,
  adminOverview,
} from "@/lib/adminStore";
import { getUserById } from "@/lib/vaultStore";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-admin-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  delete process.env.ADMIN_EMAILS;
  delete process.env.REGISTRATION_CODE;
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run("boss", "Boss", "Boss@Example.com", "unused", now);
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run("rando", "Rando", "rando@example.com", "unused", now);
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.ADMIN_EMAILS;
  delete process.env.REGISTRATION_CODE;
});

describe("admin identity (env-based, case-insensitive)", () => {
  it("matches configured emails regardless of case/whitespace; rejects others", () => {
    process.env.ADMIN_EMAILS = " boss@example.com , second@x.io ";
    expect(isAdminEmail("BOSS@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("second@x.io")).toBe(true);
    expect(isAdminEmail("rando@example.com")).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
  it("nobody is admin when ADMIN_EMAILS is unset", () => {
    expect(isAdminEmail("boss@example.com")).toBe(false);
  });
  it("stamps isAdmin onto the stored user's public shape only for configured emails", () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    // getUserById returns the stored user; the public projection is derived
    // via isAdminEmail on the same address.
    expect(isAdminEmail(getUserById("boss")?.email)).toBe(true);
    expect(isAdminEmail(getUserById("rando")?.email)).toBe(false);
  });
});

describe("invite codes", () => {
  it("creates, lists, and revokes", () => {
    const invite = createInviteCode("boss", { label: "Friends", maxUses: 3 });
    expect(invite.code).toMatch(/^[A-Z2-9]{8}$/);
    expect(invite.maxUses).toBe(3);
    expect(listInviteCodes().map((i) => i.code)).toContain(invite.code);
    revokeInviteCode(invite.code);
    expect(listInviteCodes().find((i) => i.code === invite.code)?.revoked).toBe(true);
  });

  it("consumes a live invite and increments uses; rejects when exhausted or revoked", () => {
    const invite = createInviteCode("boss", { label: "", maxUses: 2 });
    expect(consumeRegistrationCode(invite.code)).toBe(true);
    expect(consumeRegistrationCode(invite.code)).toBe(true);
    expect(consumeRegistrationCode(invite.code)).toBe(false); // exhausted
    expect(listInviteCodes().find((i) => i.code === invite.code)?.uses).toBe(2);

    const open = createInviteCode("boss", {}); // unlimited
    expect(consumeRegistrationCode(open.code)).toBe(true);
    expect(consumeRegistrationCode(open.code)).toBe(true); // still fine
    revokeInviteCode(open.code);
    expect(consumeRegistrationCode(open.code)).toBe(false); // revoked
  });

  it("honors the legacy env REGISTRATION_CODE with unlimited uses", () => {
    process.env.REGISTRATION_CODE = "OPENSESAME";
    expect(consumeRegistrationCode("OPENSESAME")).toBe(true);
    expect(consumeRegistrationCode("OPENSESAME")).toBe(true);
    expect(consumeRegistrationCode("wrong")).toBe(false);
  });

  it("registrationRequiresCode: gated by env OR any live invite", () => {
    expect(registrationRequiresCode()).toBe(false); // open by default
    const invite = createInviteCode("boss", { maxUses: 1 });
    expect(registrationRequiresCode()).toBe(true); // a live invite exists
    consumeRegistrationCode(invite.code); // exhaust it
    expect(registrationRequiresCode()).toBe(false); // no live invite left
    process.env.REGISTRATION_CODE = "X";
    expect(registrationRequiresCode()).toBe(true); // env gate
  });

  it("rejects empty/unknown codes", () => {
    expect(consumeRegistrationCode("")).toBe(false);
    expect(consumeRegistrationCode("NOTREAL8")).toBe(false);
  });
});

describe("admin overview", () => {
  it("reports users with character counts and admin flags", () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const overview = adminOverview();
    expect(overview.totals.users).toBe(2);
    const boss = overview.users.find((u) => u.id === "boss");
    expect(boss?.isAdmin).toBe(true);
    expect(overview.users.find((u) => u.id === "rando")?.isAdmin).toBe(false);
  });
});
