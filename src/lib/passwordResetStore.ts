import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

const RESET_EXPIRY_HOURS = 1;

type ResetTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
};

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createPasswordResetToken(userId: string): string {
  const db = getDb();
  const rawToken = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM password_reset_tokens WHERE expires_at <= ? OR user_id = ?")
      .run(now.toISOString(), userId);
    db.prepare("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), userId, hashToken(rawToken), expiresAt.toISOString(), now.toISOString());
    db.exec("COMMIT");
    return rawToken;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function consumePasswordResetToken(rawToken: string): string | null {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT id, user_id, token_hash, expires_at FROM password_reset_tokens WHERE token_hash = ?")
      .get(hashToken(rawToken)) as ResetTokenRow | undefined;
    if (!row) {
      db.exec("COMMIT");
      return null;
    }
    db.prepare("DELETE FROM password_reset_tokens WHERE id = ?").run(row.id);
    if (Date.parse(row.expires_at) <= Date.now()) {
      db.exec("COMMIT");
      return null;
    }
    db.exec("COMMIT");
    return row.user_id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function purgeExpiredPasswordResetTokens(): number {
  return getDb().prepare("DELETE FROM password_reset_tokens WHERE expires_at <= ?").run(new Date().toISOString()).changes;
}
