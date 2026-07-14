import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

/**
 * User-uploaded portrait images, stored as BLOBs in SQLite so they live in
 * the same data volume as everything else. A stored portrait is referenced
 * from character.portraitUrl as the site-relative path `/api/portraits/<id>`,
 * which the existing portraitUrl validation and <img> rendering already
 * accept as an external image link.
 */

export const MAX_PORTRAIT_SIZE = 4 * 1024 * 1024; // 4 MB
/** Uploads per user — a safety valve against unbounded BLOB growth. */
export const MAX_PORTRAITS_PER_USER = 50;

export const PORTRAIT_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

/** Magic-byte check: the declared MIME type must match the actual bytes. */
export function sniffImageMime(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  const gifHeader = bytes.subarray(0, 6).toString("ascii");
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") return "image/gif";
  return null;
}

export function countUserPortraits(userId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM user_portraits WHERE user_id = ?")
    .get(userId) as { count: number };
  return row.count;
}

export function savePortrait(userId: string, mime: string, bytes: Buffer): string {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO user_portraits (id, user_id, mime, bytes, size, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, userId, mime, bytes, bytes.length, new Date().toISOString());
  return id;
}

export function getPortrait(id: string): { mime: string; bytes: Buffer } | null {
  const row = getDb()
    .prepare("SELECT mime, bytes FROM user_portraits WHERE id = ?")
    .get(id) as { mime: string; bytes: Uint8Array } | undefined;
  return row ? { mime: row.mime, bytes: Buffer.from(row.bytes) } : null;
}
