import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { signToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { GET as LIST, POST as CREATE } from "@/app/api/homebrew/route";
import { GET as DETAIL } from "@/app/api/homebrew/[definitionId]/route";
import { POST as SAVE } from "@/app/api/homebrew/[definitionId]/versions/route";
import { GET as READ_VERSION } from "@/app/api/homebrew/[definitionId]/versions/[versionId]/route";
import { POST as PUBLISH } from "@/app/api/homebrew/[definitionId]/versions/[versionId]/publish/route";
import { POST as VALIDATE } from "@/app/api/homebrew/validate/route";
import { plusTwoWeapon } from "./fixtures/homebrew";

let dataDir = "";
let cookie = "";

beforeEach(async () => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-hb-api-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  process.env.JWT_SECRET = "homebrew-test-secret-homebrew-test-secret";
  getDb()
    .prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run("alice", "Alice", "alice@example.com", "x", new Date().toISOString());
  cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(await signToken({ userId: "alice" }))}`;
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
  delete process.env.JWT_SECRET;
});

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://local/api/homebrew", {
    method: "POST",
    headers: { "content-type": "application/json", cookie, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const params = <T>(value: T) => ({ params: Promise.resolve(value) });

async function createWeapon() {
  const res = await CREATE(req({ kind: "item", ruleset: "2014", title: "Moonsteel Blade", payload: plusTwoWeapon }));
  expect(res.status).toBe(201);
  return (await res.json()) as { definition: { id: string; revision: number }; version: { id: string } };
}

describe("homebrew API lifecycle", () => {
  it("creates, lists, reads, versions, publishes, and re-reads through handlers", async () => {
    const { definition, version } = await createWeapon();

    const listRes = await LIST(new Request("http://local/api/homebrew", { headers: { cookie } }));
    expect(((await listRes.json()) as { definitions: unknown[] }).definitions).toHaveLength(1);

    const detailRes = await DETAIL(new Request("http://local/api/homebrew/x", { headers: { cookie } }), params({ definitionId: definition.id }));
    const detail = (await detailRes.json()) as { definition: { revision: number }; versions: unknown[] };
    expect(detail.versions).toHaveLength(1);

    const saveRes = await SAVE(
      req({ payload: { ...plusTwoWeapon, description: "sharper" }, changeSummary: "tweak" }, { "if-match": String(detail.definition.revision) }),
      params({ definitionId: definition.id }),
    );
    expect(saveRes.status).toBe(201);
    const saved = (await saveRes.json()) as { version: { id: string; ordinal: number } };
    expect(saved.version.ordinal).toBe(2);

    const pubRes = await PUBLISH(req({}), params({ definitionId: definition.id, versionId: version.id }));
    expect(((await pubRes.json()) as { version: { status: string } }).version.status).toBe("published");

    const readRes = await READ_VERSION(new Request("http://local", { headers: { cookie } }), params({ definitionId: definition.id, versionId: version.id }));
    expect(readRes.status).toBe(200);
  });

  it("returns 409 with the current revision on a stale save", async () => {
    const { definition } = await createWeapon();
    const res = await SAVE(
      req({ payload: plusTwoWeapon, changeSummary: "x" }, { "if-match": "99" }),
      params({ definitionId: definition.id }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()) as { currentRevision: number }).toMatchObject({ currentRevision: 0 });
  });

  it("returns 428 when the save omits If-Match", async () => {
    const { definition } = await createWeapon();
    const res = await SAVE(req({ payload: plusTwoWeapon, changeSummary: "x" }), params({ definitionId: definition.id }));
    expect(res.status).toBe(428);
  });

  it("returns 413 for an oversized body", async () => {
    const huge = "x".repeat(600 * 1024);
    const res = await CREATE(req({ kind: "item", ruleset: "2014", title: "Big", payload: plusTwoWeapon, note: huge }));
    expect(res.status).toBe(413);
  });

  it("returns 400 for an invalid create payload", async () => {
    const res = await CREATE(req({ kind: "item", ruleset: "2014", title: "Bad", payload: { kind: "item" } }));
    expect(res.status).toBe(400);
  });

  it("validate route reports diagnostics without persisting", async () => {
    const res = await VALIDATE(req({ payload: { kind: "item", name: "" } }));
    const body = (await res.json()) as { valid: boolean; errors: unknown[] };
    expect(body.valid).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await LIST(new Request("http://local/api/homebrew"));
    expect(res.status).toBe(401);
  });
});
