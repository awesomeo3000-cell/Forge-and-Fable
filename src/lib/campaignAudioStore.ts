import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export const MAX_CAMPAIGN_AUDIO_SIZE = 25 * 1024 * 1024;

export const CAMPAIGN_AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
]);

export function sniffAudioMime(bytes: Buffer, declaredMime: string): string | null {
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WAVE") return "audio/wav";
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "OggS") return "audio/ogg";
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "fLaC") return "audio/flac";
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "ID3") return "audio/mpeg";
  if (bytes.length >= 8 && bytes.subarray(4, 8).toString("ascii") === "ftyp") return "audio/mp4";
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "audio/webm";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return CAMPAIGN_AUDIO_MIME_TYPES.has(declaredMime) ? declaredMime : null;
}

export function saveCampaignAudioAsset(campaignId: string, mime: string, bytes: Buffer): string {
  const id = randomUUID();
  getDb().prepare("INSERT INTO campaign_audio_assets (id, campaign_id, mime, bytes, size, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, campaignId, mime, bytes, bytes.length, new Date().toISOString());
  return id;
}

export function getCampaignAudioAsset(id: string, campaignId: string, userId: string): { mime: string; bytes: Buffer } | null {
  const row = getDb().prepare(`
    SELECT a.mime, a.bytes
    FROM campaign_audio_assets a
    INNER JOIN campaign_members m ON m.campaign_id = a.campaign_id AND m.user_id = ?
    WHERE a.id = ? AND a.campaign_id = ?
  `).get(userId, id, campaignId) as { mime: string; bytes: Uint8Array } | undefined;
  return row ? { mime: row.mime, bytes: Buffer.from(row.bytes) } : null;
}

export function deleteCampaignAudioAsset(id: string, campaignId: string) {
  getDb().prepare("DELETE FROM campaign_audio_assets WHERE id = ? AND campaign_id = ?").run(id, campaignId);
}
