import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createHandoutFolder, listHandoutFolders } from "@/lib/dmToolsStore";
import { dmToolsError } from "@/lib/dmToolsRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    return NextResponse.json({ folders: listHandoutFolders(id, userId) });
  } catch (error) {
    return dmToolsError(error, "Could not list handout folders.");
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { name?: unknown };
    return NextResponse.json({ folder: createHandoutFolder(id, userId, typeof body.name === "string" ? body.name : "") }, { status: 201 });
  } catch (error) {
    return dmToolsError(error, "Could not create handout folder.");
  }
}
