import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  unreadNotificationCount,
  updateNotificationPreferences,
} from "@/lib/notificationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    return NextResponse.json({
      notifications: listNotifications(userId),
      unreadCount: unreadNotificationCount(userId),
      preferences: getNotificationPreferences(userId),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.markAllRead === true) {
      markAllNotificationsRead(userId);
      return NextResponse.json({
        ok: true,
        unreadCount: 0,
        preferences: getNotificationPreferences(userId),
      });
    }
    return NextResponse.json({
      preferences: updateNotificationPreferences(userId, {
        dmInboxEnabled: typeof body.dmInboxEnabled === "boolean" ? body.dmInboxEnabled : undefined,
        dmEmailEnabled: typeof body.dmEmailEnabled === "boolean" ? body.dmEmailEnabled : undefined,
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not update notification preferences." }, { status: 400 });
  }
}
