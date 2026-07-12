/**
 * Admin identity, configured out-of-band via the ADMIN_EMAILS env var
 * (comma-separated, case-insensitive). Deliberately NOT a database flag: it
 * can't be granted by any in-app action, survives DB resets, and needs no
 * bootstrap. Pure + dependency-free so both vaultStore (to stamp PublicUser)
 * and the server admin guard can use it without a circular import.
 */
export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.trim().toLowerCase());
}
