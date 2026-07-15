import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAdmin(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized." }, { status: 500 });
  }

  const { userId } = await params;
  const db = getDb();

  const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(userId) as { id: string; email: string } | undefined;
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    db.exec("COMMIT");
    return NextResponse.json({ deleted: { id: user.id, email: user.email } });
  } catch (error) {
    db.exec("ROLLBACK");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete user." },
      { status: 500 },
    );
  }
}
