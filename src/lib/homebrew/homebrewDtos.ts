/**
 * DTO shaping for homebrew content (server -> client).
 *
 * These types define exactly what leaves the server. They deliberately omit
 * `ownerUserId`, and list/metadata DTOs omit version payloads. Creator-only
 * fields (creator notes) live inside the payload and are only ever returned to
 * the owner via a full-version read. See proposal §12/§18.
 */
import type {
  ContentBaseline,
  ContentVisibility,
  HomebrewKind,
  HomebrewPayload,
  VersionStatus,
} from "@/types/homebrew";
import type { RulesetId } from "@/types/game";

/** Raw row shapes as stored in SQLite (snake_case columns mapped to camelCase). */
export type DefinitionRow = {
  id: string;
  owner_user_id: string | null;
  kind: string;
  ruleset: string;
  slug: string;
  title: string;
  visibility: string;
  current_version_id: string | null;
  latest_published_version_id: string | null;
  revision: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VersionRow = {
  id: string;
  definition_id: string;
  ordinal: number;
  label: string | null;
  status: string;
  schema_version: number;
  payload_json: string;
  parent_version_id: string | null;
  baseline_json: string | null;
  change_summary: string;
  content_hash: string;
  created_by_user_id: string | null;
  created_at: string;
  published_at: string | null;
};

/** Definition metadata returned to any authorized viewer. No owner id. */
export type DefinitionDto = {
  id: string;
  kind: HomebrewKind;
  ruleset: RulesetId;
  slug: string;
  title: string;
  visibility: ContentVisibility;
  currentVersionId?: string;
  latestPublishedVersionId?: string;
  revision: number;
  archived: boolean;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Version metadata for list/history views — no payload. */
export type VersionSummaryDto = {
  id: string;
  definitionId: string;
  ordinal: number;
  label?: string;
  status: VersionStatus;
  schemaVersion: number;
  changeSummary: string;
  contentHash: string;
  parentVersionId?: string;
  baseline?: ContentBaseline;
  createdAt: string;
  publishedAt?: string;
};

/** A single version with its decoded payload — returned only when authorized. */
export type VersionDto = VersionSummaryDto & { payload: HomebrewPayload };

export function toDefinitionDto(row: DefinitionRow, viewerUserId: string): DefinitionDto {
  return {
    id: row.id,
    kind: row.kind as HomebrewKind,
    ruleset: row.ruleset as RulesetId,
    slug: row.slug,
    title: row.title,
    visibility: row.visibility as ContentVisibility,
    currentVersionId: row.current_version_id ?? undefined,
    latestPublishedVersionId: row.latest_published_version_id ?? undefined,
    revision: row.revision,
    archived: row.archived_at != null,
    isOwner: row.owner_user_id != null && row.owner_user_id === viewerUserId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toVersionSummaryDto(row: VersionRow): VersionSummaryDto {
  return {
    id: row.id,
    definitionId: row.definition_id,
    ordinal: row.ordinal,
    label: row.label ?? undefined,
    status: row.status as VersionStatus,
    schemaVersion: row.schema_version,
    changeSummary: row.change_summary,
    contentHash: row.content_hash,
    parentVersionId: row.parent_version_id ?? undefined,
    baseline: row.baseline_json ? (JSON.parse(row.baseline_json) as ContentBaseline) : undefined,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? undefined,
  };
}

export function toVersionDto(row: VersionRow): VersionDto {
  return {
    ...toVersionSummaryDto(row),
    payload: JSON.parse(row.payload_json) as HomebrewPayload,
  };
}
