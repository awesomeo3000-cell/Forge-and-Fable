/**
 * Homebrew content data-access layer (SQLite transactions only).
 *
 * This is the single writer for the homebrew tables. Ownership and visibility
 * checks live HERE, not only in route handlers (proposal §12/§18). Every mutation
 * is a single `BEGIN IMMEDIATE` transaction; published versions are immutable and
 * never rewritten; definitions use an optimistic `revision` token.
 */
import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { validateHomebrewPayload, type ValidationError } from "@/lib/homebrew/homebrewSchema";
import {
  toDefinitionDto,
  toVersionDto,
  toVersionSummaryDto,
  type DefinitionDto,
  type DefinitionRow,
  type VersionDto,
  type VersionRow,
  type VersionSummaryDto,
} from "@/lib/homebrew/homebrewDtos";
import {
  HOMEBREW_SCHEMA_VERSION,
  type ContentBaseline,
  type ContentVisibility,
  type HomebrewKind,
  type HomebrewPayload,
} from "@/types/homebrew";
import type { RulesetId } from "@/types/game";

// ── Errors (HTTP status carried for the route layer) ────────────────────────
export class HomebrewNotFoundError extends Error {
  status = 404 as const;
  constructor(message = "Homebrew content not found.") {
    super(message);
    this.name = "HomebrewNotFoundError";
  }
}
export class HomebrewAuthorizationError extends Error {
  status = 403 as const;
  constructor(message = "You do not have access to this homebrew content.") {
    super(message);
    this.name = "HomebrewAuthorizationError";
  }
}
export class HomebrewConflictError extends Error {
  status = 409 as const;
  constructor(
    message: string,
    public readonly currentRevision: number,
  ) {
    super(message);
    this.name = "HomebrewConflictError";
  }
}
export class HomebrewStateError extends Error {
  status = 409 as const;
  constructor(message: string) {
    super(message);
    this.name = "HomebrewStateError";
  }
}
export class HomebrewValidationError extends Error {
  status = 400 as const;
  constructor(
    message: string,
    public readonly errors: ValidationError[],
  ) {
    super(message);
    this.name = "HomebrewValidationError";
  }
}

// ── Canonical hashing (stable key order) ────────────────────────────────────
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}
export function contentHash(payload: HomebrewPayload): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length > 0 ? base : "untitled";
}

function assertPayloadValid(payload: unknown): asserts payload is HomebrewPayload {
  const errors = validateHomebrewPayload(payload);
  if (errors.length > 0) {
    const first = errors[0];
    throw new HomebrewValidationError(`Invalid homebrew payload: ${first.path} ${first.message}`, errors);
  }
}

function assertPayloadMatches(payload: HomebrewPayload, kind: HomebrewKind): void {
  if (payload.kind !== kind) {
    throw new HomebrewValidationError(`Payload kind "${payload.kind}" does not match definition kind "${kind}".`, [
      { path: "kind", message: `must be "${kind}"` },
    ]);
  }
}

function deepCopyPayload(payload: HomebrewPayload): HomebrewPayload {
  // A stored version must never alias the caller's object graph (clone safety).
  return JSON.parse(JSON.stringify(payload)) as HomebrewPayload;
}

/** True when a non-owner may read this definition (campaign-shared + member). */
function viewerCanRead(row: DefinitionRow, viewerUserId: string): boolean {
  if (row.owner_user_id === viewerUserId) return true;
  if (row.visibility !== "campaign") return false;
  const shared = getDb()
    .prepare(
      `SELECT 1
         FROM campaign_homebrew_access access
         JOIN campaign_members member
           ON member.campaign_id = access.campaign_id
        WHERE access.definition_id = ?
          AND access.revoked_at IS NULL
          AND member.user_id = ?
        LIMIT 1`,
    )
    .get(row.id, viewerUserId);
  return shared != null;
}

function loadDefinitionRow(definitionId: string): DefinitionRow | undefined {
  return getDb().prepare("SELECT * FROM homebrew_definitions WHERE id = ?").get(definitionId) as
    | DefinitionRow
    | undefined;
}

/** Load a definition the viewer may read, or throw 404. */
function loadReadable(viewerUserId: string, definitionId: string): DefinitionRow {
  const row = loadDefinitionRow(definitionId);
  if (!row || !viewerCanRead(row, viewerUserId)) throw new HomebrewNotFoundError();
  return row;
}

function nextAvailableSlug(ownerUserId: string, kind: HomebrewKind, desired: string): string {
  const base = slugify(desired);
  const taken = new Set(
    (
      getDb()
        .prepare(
          "SELECT slug FROM homebrew_definitions WHERE owner_user_id = ? AND kind = ? AND archived_at IS NULL",
        )
        .all(ownerUserId, kind) as Array<{ slug: string }>
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

// ── Reads ────────────────────────────────────────────────────────────────────
export type ListFilters = { kind?: HomebrewKind; includeArchived?: boolean };

export function listOwnedDefinitions(userId: string, filters: ListFilters = {}): DefinitionDto[] {
  const clauses = ["owner_user_id = ?"];
  const params: unknown[] = [userId];
  if (filters.kind) {
    clauses.push("kind = ?");
    params.push(filters.kind);
  }
  if (!filters.includeArchived) clauses.push("archived_at IS NULL");
  const rows = getDb()
    .prepare(`SELECT * FROM homebrew_definitions WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC`)
    .all(...params) as DefinitionRow[];
  return rows.map((row) => toDefinitionDto(row, userId));
}

export type DefinitionDetail = { definition: DefinitionDto; versions: VersionSummaryDto[] };

export function getDefinitionDetail(userId: string, definitionId: string): DefinitionDetail {
  const row = loadReadable(userId, definitionId);
  const isOwner = row.owner_user_id === userId;
  const versionRows = getDb()
    .prepare("SELECT * FROM homebrew_versions WHERE definition_id = ? ORDER BY ordinal ASC")
    .all(definitionId) as VersionRow[];
  // Non-owners never see drafts.
  const visible = isOwner ? versionRows : versionRows.filter((v) => v.status !== "draft");
  return { definition: toDefinitionDto(row, userId), versions: visible.map(toVersionSummaryDto) };
}

export function getVersion(userId: string, definitionId: string, versionId: string): VersionDto {
  const row = loadReadable(userId, definitionId);
  const isOwner = row.owner_user_id === userId;
  const versionRow = getDb()
    .prepare("SELECT * FROM homebrew_versions WHERE id = ? AND definition_id = ?")
    .get(versionId, definitionId) as VersionRow | undefined;
  if (!versionRow) throw new HomebrewNotFoundError("Version not found.");
  if (!isOwner && versionRow.status === "draft") throw new HomebrewNotFoundError("Version not found.");
  return toVersionDto(versionRow);
}

// ── Writes ───────────────────────────────────────────────────────────────────
export type CreateDefinitionInput = {
  kind: HomebrewKind;
  ruleset: RulesetId;
  title: string;
  visibility?: ContentVisibility;
  payload: HomebrewPayload;
  changeSummary?: string;
  /** When present, this creation is a clone; provenance is preserved. */
  baseline?: ContentBaseline;
  label?: string;
};

export type CreateDefinitionResult = { definition: DefinitionDto; version: VersionDto };

export function createDefinition(userId: string, input: CreateDefinitionInput): CreateDefinitionResult {
  assertPayloadValid(input.payload);
  assertPayloadMatches(input.payload, input.kind);

  const db = getDb();
  const now = new Date().toISOString();
  const definitionId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const slug = nextAvailableSlug(userId, input.kind, input.title);
  const payload = deepCopyPayload(input.payload);
  const hash = contentHash(payload);

  db.exec("BEGIN IMMEDIATE");
  try {
    if (!db.prepare("SELECT id FROM users WHERE id = ?").get(userId)) {
      throw new HomebrewAuthorizationError("Session user not found.");
    }
    db.prepare(
      `INSERT INTO homebrew_definitions
         (id, owner_user_id, kind, ruleset, slug, title, visibility, current_version_id,
          latest_published_version_id, revision, archived_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)`,
    ).run(
      definitionId,
      userId,
      input.kind,
      input.ruleset,
      slug,
      input.title,
      input.visibility ?? "private",
      versionId,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO homebrew_versions
         (id, definition_id, ordinal, label, status, schema_version, payload_json,
          parent_version_id, baseline_json, change_summary, content_hash, created_by_user_id,
          created_at, published_at)
       VALUES (?, ?, 1, ?, 'draft', ?, ?, NULL, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      versionId,
      definitionId,
      input.label ?? null,
      HOMEBREW_SCHEMA_VERSION,
      JSON.stringify(payload),
      input.baseline ? JSON.stringify(input.baseline) : null,
      input.changeSummary ?? (input.baseline ? "Cloned from baseline" : "Initial draft"),
      hash,
      userId,
      now,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    definition: toDefinitionDto(loadDefinitionRow(definitionId)!, userId),
    version: getVersion(userId, definitionId, versionId),
  };
}

export type SaveVersionInput = {
  payload: HomebrewPayload;
  changeSummary: string;
  label?: string;
  parentVersionId?: string;
  /** Optimistic token from the last definition load. */
  expectedRevision: number;
};

export function saveVersion(userId: string, definitionId: string, input: SaveVersionInput): VersionDto {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = loadDefinitionRow(definitionId);
    if (!row || !viewerCanRead(row, userId)) throw new HomebrewNotFoundError();
    if (row.owner_user_id !== userId) throw new HomebrewAuthorizationError();
    if (row.revision !== input.expectedRevision) {
      throw new HomebrewConflictError("This content changed since you loaded it.", row.revision);
    }
    assertPayloadValid(input.payload);
    assertPayloadMatches(input.payload, row.kind as HomebrewKind);

    const parentVersionId = input.parentVersionId ?? row.current_version_id;
    if (parentVersionId) {
      const parent = db
        .prepare("SELECT id FROM homebrew_versions WHERE id = ? AND definition_id = ?")
        .get(parentVersionId, definitionId);
      if (!parent) throw new HomebrewValidationError("parentVersionId does not belong to this definition.", [
        { path: "parentVersionId", message: "unknown version" },
      ]);
    }

    const maxOrdinal =
      (db.prepare("SELECT MAX(ordinal) AS max FROM homebrew_versions WHERE definition_id = ?").get(definitionId) as {
        max: number | null;
      }).max ?? 0;
    const versionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const payload = deepCopyPayload(input.payload);

    db.prepare(
      `INSERT INTO homebrew_versions
         (id, definition_id, ordinal, label, status, schema_version, payload_json,
          parent_version_id, baseline_json, change_summary, content_hash, created_by_user_id,
          created_at, published_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, NULL, ?, ?, ?, ?, NULL)`,
    ).run(
      versionId,
      definitionId,
      maxOrdinal + 1,
      input.label ?? null,
      HOMEBREW_SCHEMA_VERSION,
      JSON.stringify(payload),
      parentVersionId ?? null,
      input.changeSummary,
      contentHash(payload),
      userId,
      now,
    );
    db.prepare(
      "UPDATE homebrew_definitions SET current_version_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
    ).run(versionId, now, definitionId);
    db.exec("COMMIT");
    return getVersion(userId, definitionId, versionId);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function publishVersion(userId: string, definitionId: string, versionId: string): VersionDto {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = loadDefinitionRow(definitionId);
    if (!row || !viewerCanRead(row, userId)) throw new HomebrewNotFoundError();
    if (row.owner_user_id !== userId) throw new HomebrewAuthorizationError();

    const version = db
      .prepare("SELECT * FROM homebrew_versions WHERE id = ? AND definition_id = ?")
      .get(versionId, definitionId) as VersionRow | undefined;
    if (!version) throw new HomebrewNotFoundError("Version not found.");
    if (version.status === "deprecated") throw new HomebrewStateError("Cannot publish a deprecated version.");

    // Re-validate strictly before publishing; never rewrite the stored payload.
    assertPayloadValid(JSON.parse(version.payload_json));

    const now = new Date().toISOString();
    if (version.status !== "published") {
      db.prepare("UPDATE homebrew_versions SET status = 'published', published_at = ? WHERE id = ?").run(
        now,
        versionId,
      );
    }
    db.prepare(
      "UPDATE homebrew_definitions SET latest_published_version_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
    ).run(versionId, now, definitionId);
    db.exec("COMMIT");
    return getVersion(userId, definitionId, versionId);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function deprecateVersion(userId: string, definitionId: string, versionId: string): VersionDto {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = loadDefinitionRow(definitionId);
    if (!row || !viewerCanRead(row, userId)) throw new HomebrewNotFoundError();
    if (row.owner_user_id !== userId) throw new HomebrewAuthorizationError();

    const version = db
      .prepare("SELECT status FROM homebrew_versions WHERE id = ? AND definition_id = ?")
      .get(versionId, definitionId) as { status: string } | undefined;
    if (!version) throw new HomebrewNotFoundError("Version not found.");
    if (version.status !== "published") throw new HomebrewStateError("Only published versions can be deprecated.");

    const now = new Date().toISOString();
    db.prepare("UPDATE homebrew_versions SET status = 'deprecated' WHERE id = ?").run(versionId);
    // If this was the latest published pointer, clear it back to the newest remaining published version.
    if (row.latest_published_version_id === versionId) {
      const fallback = db
        .prepare(
          "SELECT id FROM homebrew_versions WHERE definition_id = ? AND status = 'published' ORDER BY ordinal DESC LIMIT 1",
        )
        .get(definitionId) as { id: string } | undefined;
      db.prepare(
        "UPDATE homebrew_definitions SET latest_published_version_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
      ).run(fallback?.id ?? null, now, definitionId);
    }
    db.exec("COMMIT");
    return getVersion(userId, definitionId, versionId);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export type UpdateDefinitionInput = {
  title?: string;
  visibility?: ContentVisibility;
  archived?: boolean;
  expectedRevision: number;
};

export function updateDefinitionMetadata(
  userId: string,
  definitionId: string,
  input: UpdateDefinitionInput,
): DefinitionDto {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = loadDefinitionRow(definitionId);
    if (!row || !viewerCanRead(row, userId)) throw new HomebrewNotFoundError();
    if (row.owner_user_id !== userId) throw new HomebrewAuthorizationError();
    if (row.revision !== input.expectedRevision) {
      throw new HomebrewConflictError("This content changed since you loaded it.", row.revision);
    }

    const now = new Date().toISOString();
    const title = input.title ?? row.title;
    const visibility = input.visibility ?? (row.visibility as ContentVisibility);
    const archivedAt = input.archived === undefined ? row.archived_at : input.archived ? now : null;

    db.prepare(
      "UPDATE homebrew_definitions SET title = ?, visibility = ?, archived_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
    ).run(title, visibility, archivedAt, now, definitionId, input.expectedRevision);
    db.exec("COMMIT");
    return toDefinitionDto(loadDefinitionRow(definitionId)!, userId);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
