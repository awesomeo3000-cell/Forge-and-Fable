import { getDb } from "@/lib/db";

function rows(sql: string, userId: string) {
  return getDb().prepare(sql).all(userId) as Array<Record<string, unknown>>;
}

function parsedJsonRows(sql: string, userId: string) {
  return rows(sql, userId).map((row) => ({
    ...row,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
  }));
}

/** Export the requesting user's personal app data without credentials,
 * authentication tokens, other users' records, or uploaded binary BLOBs. */
export function exportAccountData(userId: string) {
  const db = getDb();
  const account = db.prepare(`
    SELECT id, name, email, created_at AS createdAt, email_verified AS emailVerified
    FROM users WHERE id = ?
  `).get(userId) as Record<string, unknown> | undefined;
  if (!account) throw new Error("Account not found.");

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    account,
    characters: parsedJsonRows("SELECT id, revision, data, created_at AS createdAt, updated_at AS updatedAt FROM characters WHERE user_id = ? ORDER BY created_at", userId),
    feedback: parsedJsonRows("SELECT id, data, created_at AS createdAt FROM feedback WHERE user_id = ? ORDER BY created_at", userId),
    campaignsOwned: rows("SELECT id, name, code, theme_key AS themeKey, banner_image_url AS bannerImageUrl, created_at AS createdAt FROM campaigns WHERE dm_user_id = ? ORDER BY created_at", userId),
    campaignMemberships: rows("SELECT campaign_id AS campaignId, character_id AS characterId, joined_at AS joinedAt, is_ghost AS isGhost FROM campaign_members WHERE user_id = ? ORDER BY joined_at", userId),
    campaignRolls: rows("SELECT id, campaign_id AS campaignId, character_name AS characterName, label, total, detail, created_at AS createdAt FROM campaign_rolls WHERE user_id = ? ORDER BY created_at", userId),
    campaignPresence: rows("SELECT campaign_id AS campaignId, character_id AS characterId, visibility, last_seen_at AS lastSeenAt FROM campaign_presence WHERE user_id = ?", userId),
    campaignCharacterNotes: rows("SELECT id, campaign_id AS campaignId, character_id AS characterId, category, title, body, reminder_id AS reminderId, resolved_at AS resolvedAt, created_at AS createdAt, updated_at AS updatedAt FROM campaign_character_notes WHERE campaign_id IN (SELECT id FROM campaigns WHERE dm_user_id = ?) ORDER BY updated_at", userId),
    campaignRequestResponses: rows("SELECT request_id AS requestId, status, total, passed, summary, responded_at AS respondedAt FROM campaign_request_responses WHERE user_id = ? ORDER BY responded_at", userId),
    creatures: parsedJsonRows("SELECT id, campaign_id AS campaignId, kind, data, archived, created_at AS createdAt, updated_at AS updatedAt, last_used_at AS lastUsedAt FROM creature_library WHERE owner_user_id = ? ORDER BY updated_at", userId),
    encounters: parsedJsonRows("SELECT id, campaign_id AS campaignId, status, origin, data, created_at AS createdAt, updated_at AS updatedAt, last_used_at AS lastUsedAt FROM saved_encounters WHERE owner_user_id = ? ORDER BY updated_at", userId),
    handouts: parsedJsonRows("SELECT id, campaign_id AS campaignId, data, shared, first_shared_at AS firstSharedAt, last_shared_at AS lastSharedAt, share_count AS shareCount, archived, created_at AS createdAt, updated_at AS updatedAt FROM campaign_handouts WHERE owner_user_id = ? ORDER BY updated_at", userId),
    journalEntries: parsedJsonRows("SELECT id, campaign_id AS campaignId, entry_type AS entryType, visibility, status, data, created_at AS createdAt, updated_at AS updatedAt FROM campaign_journal_entries WHERE owner_user_id = ? ORDER BY updated_at", userId),
    portraits: rows("SELECT id, mime, size, created_at AS createdAt FROM user_portraits WHERE user_id = ? ORDER BY created_at", userId),
    pdfImports: rows("SELECT id, status, original_filename AS originalFilename, size_bytes AS sizeBytes, page_count AS pageCount, requires_ocr AS requiresOcr, progress_percent AS progressPercent, error_code AS errorCode, created_at AS createdAt, updated_at AS updatedAt, expires_at AS expiresAt FROM pdf_import_jobs WHERE user_id = ? ORDER BY created_at", userId),
  };
}
