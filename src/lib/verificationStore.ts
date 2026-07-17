import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";

const VERIFICATION_EXPIRY_HOURS = 24;

/** Explicit off-switch for email verification (local/self-hosted servers).
 *  NODE_ENV can't be the only gate: the local server runs a production build
 *  via `next start`, which would otherwise demand real verification emails. */
export function emailVerificationDisabled(): boolean {
  return process.env.DISABLE_EMAIL_VERIFICATION === "true";
}

type VerificationTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

type UserVerifiedRow = {
  email_verified: number;
};

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Generate a verification token, store its hash in the DB, and return the
 *  raw token (to be embedded in the email link). */
export function createVerificationToken(userId: string): string {
  const db = getDb();
  const rawToken = crypto.randomUUID();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

  db.prepare(
    "INSERT INTO verification_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(crypto.randomUUID(), userId, tokenHash, expiresAt.toISOString(), now.toISOString());

  return rawToken;
}

/** Validate a raw token from a verification link. If valid, marks the user as
 *  email_verified and deletes the token. Returns the userId on success or null. */
export function consumeVerificationToken(rawToken: string): string | null {
  const db = getDb();
  const tokenHash = hashToken(rawToken);

  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db
      .prepare(
        "SELECT id, user_id, expires_at FROM verification_tokens WHERE token_hash = ?",
      )
      .get(tokenHash) as VerificationTokenRow | undefined;

    if (!row) {
      db.exec("COMMIT");
      return null;
    }

    // Delete the token regardless — single use
    db.prepare("DELETE FROM verification_tokens WHERE id = ?").run(row.id);

    if (new Date(row.expires_at) < new Date()) {
      db.exec("COMMIT");
      return null; // expired
    }

    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(row.user_id);
    db.exec("COMMIT");
    return row.user_id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Check whether a user's email has been verified. */
export function isEmailVerified(userId: string): boolean {
  const row = getDb()
    .prepare("SELECT email_verified FROM users WHERE id = ?")
    .get(userId) as UserVerifiedRow | undefined;
  return row?.email_verified === 1;
}

/** Delete expired verification tokens — call periodically or on-demand. */
export function purgeExpiredTokens(): number {
  const result = getDb()
    .prepare("DELETE FROM verification_tokens WHERE expires_at < ?")
    .run(new Date().toISOString());
  return result.changes;
}
