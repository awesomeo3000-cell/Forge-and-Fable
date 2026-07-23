import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { resolveFeedback } from "@/lib/vaultStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminUserId = await requireAdmin(request);
    const { id } = await params;
    const result = await resolveFeedback(id, adminUserId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Could not resolve feedback.";
    return NextResponse.json({ error: message }, { status: message === "Feedback not found." ? 404 : 500 });
  }
}
