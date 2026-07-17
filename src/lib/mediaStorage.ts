import { getDb } from "@/lib/db";

/** Keep media BLOBs below half of the default 1 GB deployment volume so the
 * database, WAL, imports, and migrations retain working headroom. */
export const MAX_TOTAL_MEDIA_STORAGE = 512 * 1024 * 1024;

export function totalMediaStorageBytes(): number {
  const row = getDb().prepare(`
    SELECT
      COALESCE((SELECT SUM(size) FROM user_portraits), 0) +
      COALESCE((SELECT SUM(size) FROM campaign_audio_assets), 0) AS total
  `).get() as { total: number };
  return Number(row.total);
}
