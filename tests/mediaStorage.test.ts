import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, signToken } from "@/lib/auth";
import {
  MAX_PORTRAIT_STORAGE_PER_USER,
  deleteUserPortrait,
  getPortrait,
  listUserPortraits,
  savePortrait,
  userPortraitStorage,
} from "@/lib/portraitStore";
import { DELETE as DELETE_PORTRAIT } from "@/app/api/portraits/[id]/route";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-media-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "media-storage-test-secret-media-storage-test-secret";
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)")
    .run("owner", "Owner", "owner@example.com", "unused", now);
  getDb().prepare("INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)")
    .run("other", "Other", "other@example.com", "unused", now);
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.JWT_SECRET;
});

describe("media storage lifecycle", () => {
  it("lists storage and restricts deletion to the portrait owner", () => {
    const id = savePortrait("owner", "image/png", Buffer.from([1, 2, 3]));
    expect(userPortraitStorage("owner")).toEqual({ count: 1, bytes: 3 });
    expect(listUserPortraits("owner")).toEqual([
      expect.objectContaining({ id, mime: "image/png", size: 3, portraitUrl: `/api/portraits/${id}` }),
    ]);
    expect(deleteUserPortrait("other", id)).toBe(false);
    expect(getPortrait(id)).not.toBeNull();
    expect(deleteUserPortrait("owner", id)).toBe(true);
    expect(getPortrait(id)).toBeNull();
  });

  it("enforces the per-user storage quota inside the write transaction", () => {
    getDb().prepare("INSERT INTO user_portraits(id,user_id,mime,bytes,size,created_at) VALUES(?,?,?,?,?,?)")
      .run("existing", "owner", "image/png", Buffer.from([1]), MAX_PORTRAIT_STORAGE_PER_USER - 1, new Date().toISOString());
    expect(() => savePortrait("owner", "image/png", Buffer.from([1, 2])))
      .toThrow(/Portrait storage limit/);
    expect(userPortraitStorage("owner").count).toBe(1);
  });

  it("exposes authenticated owner deletion through the API", async () => {
    const id = savePortrait("owner", "image/png", Buffer.from([1, 2, 3]));
    const token = await signToken({ userId: "owner" });
    const response = await DELETE_PORTRAIT(new Request(`http://local/api/portraits/${id}`, {
      method: "DELETE",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
    }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(getPortrait(id)).toBeNull();
  });
});
