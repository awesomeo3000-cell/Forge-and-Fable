import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notificationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    if (!markNotificationRead(userId, id)) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not update notification." }, { status: 400 });
  }
}
