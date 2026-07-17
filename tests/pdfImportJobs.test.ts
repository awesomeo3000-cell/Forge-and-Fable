import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import {
  createImportJob,
  getImportJob,
  updateImportJob,
  deleteImportJob,
  sweepExpiredImportJobs,
  jobDir,
  jobFilePath,
  isTerminalStatus,
} from "@/lib/import/jobs/importJobStore";

let dataDir = "";

beforeEach(() => {
  closeDb();
  dataDir = mkdtempSync(path.join(tmpdir(), "forge-pdfjobs-"));
  process.env.FORGE_VAULT_DIR = dataDir;
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run("u1", "One", "one@example.com", "unused", now);
});

afterEach(() => {
  closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FORGE_VAULT_DIR;
});

describe("import job store", () => {
  it("creates a job, stores the original upload, and reads it back", () => {
    const job = createImportJob("u1", "Rhea Voss.pdf", Buffer.from("%PDF-1.4 test"));
    expect(job.id).toMatch(/^imp_[a-f0-9]{24}$/);
    expect(job.status).toBe("uploaded");
    expect(job.userId).toBe("u1");
    expect(existsSync(jobFilePath(job.id, "original"))).toBe(true);

    const read = getImportJob(job.id);
    expect(read?.originalFilename).toBe("Rhea Voss.pdf");
    expect(read?.sizeBytes).toBe(13);
  });

  it("updates progress and OCR metadata", () => {
    const job = createImportJob("u1", "sheet.pdf", Buffer.from("%PDF"));
    updateImportJob(job.id, { status: "ocr-processing", progressPercent: 52, progressMessage: "Recognizing text on page 2 of 4", requiresOcr: true });
    const read = getImportJob(job.id);
    expect(read?.status).toBe("ocr-processing");
    expect(read?.progressPercent).toBe(52);
    expect(read?.requiresOcr).toBe(true);
  });

  it("rejects malformed job ids before touching the filesystem", () => {
    expect(() => jobDir("../../etc")).toThrow(/Invalid job id/);
    expect(() => jobDir("imp_zz")).toThrow(/Invalid job id/);
  });

  it("reads past-retention jobs as expired", () => {
    const job = createImportJob("u1", "sheet.pdf", Buffer.from("%PDF"));
    getDb().prepare("UPDATE pdf_import_jobs SET expires_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), job.id);
    expect(getImportJob(job.id)?.status).toBe("expired");
  });

  it("sweeps expired jobs, their files, and orphan directories", () => {
    const job = createImportJob("u1", "sheet.pdf", Buffer.from("%PDF"));
    getDb().prepare("UPDATE pdf_import_jobs SET expires_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), job.id);
    const removed = sweepExpiredImportJobs();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(getImportJob(job.id)).toBeNull();
    expect(existsSync(jobDir(job.id))).toBe(false);
  });

  it("deletes a job together with its files", () => {
    const job = createImportJob("u1", "sheet.pdf", Buffer.from("%PDF"));
    deleteImportJob(job.id);
    expect(getImportJob(job.id)).toBeNull();
    expect(existsSync(jobDir(job.id))).toBe(false);
  });

  it("treats ready/completed/failed/cancelled/expired as terminal", () => {
    expect(isTerminalStatus("ready")).toBe(true);
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isTerminalStatus("ocr-processing")).toBe(false);
  });
});
