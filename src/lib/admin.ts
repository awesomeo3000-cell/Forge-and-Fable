import { authenticateRequest, AuthError } from "@/lib/auth";
import { getUserById } from "@/lib/vaultStore";
import { isAdminEmail } from "@/lib/adminEmail";

export { isAdminEmail } from "@/lib/adminEmail";

/**
 * Authenticate a request AND require the user be an admin. Returns the admin's
 * userId, or throws AuthError (401 unauthenticated / 403 not admin). Admin
 * status is re-derived here from the authenticated user's stored email — the
 * client's `isAdmin` flag is never trusted for access. Use at the top of every
 * admin route handler.
 */
export async function requireAdmin(request: Request): Promise<string> {
  const userId = await authenticateRequest(request);
  const user = getUserById(userId);
  if (!user || !isAdminEmail(user.email)) {
    throw new AuthError("Administrator access required.", 403);
  }
  return userId;
}
