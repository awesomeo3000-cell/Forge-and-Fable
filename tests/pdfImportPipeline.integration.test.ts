/**
 * End-to-end pipeline coverage (OCR plan §27): searchable PDFs keep the fast
 * path, image-only PDFs run real OCR in the isolated worker, malformed PDFs
 * fail with a clean error code. The OCR case spawns the actual child process
 * and Tesseract WASM — it is slow (~10–30s) by nature.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { createImportJob, getImportJob, jobFilePath } from "@/lib/import/jobs/importJobStore";
import { runImportPipeline } from "@/lib/import/jobs/importPipeline";
import type { ImportDraft } from "@/lib/import/pdfTypes";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures", "pdf-import");

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-pdfpipe-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run("u1", "One", "one@example.com", "unused", now);
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

function readDraft(jobId: string): ImportDraft {
  const raw = JSON.parse(fs.readFileSync(jobFilePath(jobId, "result"), "utf8")) as { draft: ImportDraft };
  return raw.draft;
}

describe("import pipeline integration", () => {
  it("searchable PDF: skips OCR and produces a parsed draft", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "searchable.pdf"));
    const job = createImportJob("u1", "searchable.pdf", buffer);
    await runImportPipeline(job.id);

    const finished = getImportJob(job.id);
    expect(finished?.status).toBe("ready");
    expect(finished?.requiresOcr).toBe(false);
    expect(finished?.pageCount).toBe(2);

    const draft = readDraft(job.id);
    expect(draft.source.pages).toBe(2);
    // Diagnostics were recorded for the run (§20).
    const diagnostics = JSON.parse(fs.readFileSync(jobFilePath(job.id, "diagnostics"), "utf8")) as { stages: unknown[] };
    expect(diagnostics.stages.length).toBeGreaterThan(2);
  });

  it("malformed PDF: fails with a clean machine-readable code", async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "malformed.pdf"));
    const job = createImportJob("u1", "malformed.pdf", buffer);
    await runImportPipeline(job.id);

    const finished = getImportJob(job.id);
    expect(finished?.status).toBe("failed");
    expect(finished?.errorCode).toBe("PDF_MALFORMED");
    // The user-facing message never leaks internals.
    expect(finished?.errorMessage).not.toMatch(/at |Error:|node_modules/);
  });

  it("image-only PDF: runs OCR in the worker and recovers the sheet text", { timeout: 120_000 }, async () => {
    const buffer = fs.readFileSync(path.join(FIXTURES, "image-only.pdf"));
    const job = createImportJob("u1", "image-only.pdf", buffer);
    await runImportPipeline(job.id);

    const finished = getImportJob(job.id);
    expect(finished?.status).toBe("ready");
    expect(finished?.requiresOcr).toBe(true);
    expect(finished?.ocrDurationMs).toBeGreaterThan(0);

    const draft = readDraft(job.id);
    // The recognized text flows through the same parser lanes: the character
    // name and core stats printed on the image should have been recovered.
    expect(draft.identity.name.value).toMatch(/Rhea/i);
    expect(draft.identity.className.value).toMatch(/Ranger/i);
    expect(draft.identity.level.value).toBe(5);
    expect(draft.vitals.armorClass.value).toBe(16);
    expect(draft.abilities.strength.value).toBe(12);
    expect(draft.abilities.dexterity.value).toBe(17);
    // OCR output is never blindly trusted: recovered fields carry review
    // confidence so the review screen flags them (§18).
    expect(draft.identity.name.confidence).toBe("review");
  });
});
