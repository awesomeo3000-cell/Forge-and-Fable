import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { createFeedback, listFeedback } from "@/lib/vaultStore";
import type { FeedbackCategory, FeedbackPriority } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const categories = new Set<FeedbackCategory>(["bug", "idea", "balance", "content", "ui", "other"]);
const priorities = new Set<FeedbackPriority>(["low", "medium", "high", "blocking"]);

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function validateFeedback(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Feedback must be submitted as a JSON object.");
  }

  const body = raw as Record<string, unknown>;
  const category = cleanText(body.category, "idea") as FeedbackCategory;
  const priority = cleanText(body.priority, "medium") as FeedbackPriority;
  const title = cleanText(body.title).slice(0, 140);
  const details = cleanText(body.details).slice(0, 1600);
  const area = cleanText(body.area, "General").slice(0, 90);
  const page = cleanText(body.page, "/").slice(0, 240);
  const characterName = cleanText(body.characterName).slice(0, 120);

  if (!categories.has(category)) {
    throw new Error("Choose a valid feedback category.");
  }

  if (!priorities.has(priority)) {
    throw new Error("Choose a valid feedback priority.");
  }

  if (title.length < 4) {
    throw new Error("Add a short title so the feedback is easy to scan.");
  }

  if (details.length < 10) {
    throw new Error("Add a little more detail before submitting.");
  }

  return {
    category,
    priority,
    title,
    details,
    area,
    page,
    characterName: characterName || undefined,
  };
}

function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await authenticateRequest(request);
    const feedback = await listFeedback();
    return NextResponse.json({ feedback: feedback.slice(0, 75) });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load feedback." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const raw = await request.json();
    const body = validateFeedback(raw);
    const feedback = await createFeedback(userId, body);

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not submit feedback." },
      { status: 400 },
    );
  }
}
