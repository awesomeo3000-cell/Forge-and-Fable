import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { exportAccountData } from "@/lib/accountData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const body = JSON.stringify(exportAccountData(userId), null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dreamwright-account-${stamp}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not export account data." }, { status: 500 });
  }
}
