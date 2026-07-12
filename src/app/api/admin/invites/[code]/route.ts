import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { revokeInviteCode } from "@/lib/adminStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await requireAdmin(request);
    const { code } = await params;
    revokeInviteCode(code);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not revoke code." }, { status: 500 });
  }
}
