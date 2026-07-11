/**
 * POST /api/campaigns/[id]/events - DM-only campaign event push.
 */

import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { D20_DICE_RE } from "@/lib/effects";
import { postCampaignEvent } from "@/lib/campaignStore";
import type { CampaignEventType } from "@/types/campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPES: CampaignEventType[] = [
  "condition-apply",
  "condition-remove",
  "announce",
  "roll-request",
  "rest-short",
  "rest-long",
  "audio-cue",
  "handout",
];

function assertString(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${label} is required and must be at most ${max} characters.`);
  }
  return value.trim();
}

function sanitizeConditionApply(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Payload must be an object.");
  const input = payload as Record<string, unknown>;
  const out: Record<string, unknown> = {
    label: assertString(input.label, "Condition label", 48),
    source: "DM",
    active: true,
  };

  for (const key of ["ac", "attack", "damage", "saves", "checks", "initiative"]) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "number" || !Number.isInteger(input[key]) || input[key] < -20 || input[key] > 20) {
        throw new Error(`${key} must be an integer from -20 to 20.`);
      }
      out[key] = input[key];
    }
  }
  if (input.d20Dice !== undefined) {
    if (typeof input.d20Dice !== "string" || !D20_DICE_RE.test(input.d20Dice)) {
      throw new Error(`d20Dice must look like "1d4".`);
    }
    out.d20Dice = input.d20Dice;
  }
  if (input.advantageMode !== undefined) {
    if (input.advantageMode !== "advantage" && input.advantageMode !== "disadvantage") {
      throw new Error(`advantageMode must be "advantage" or "disadvantage".`);
    }
    out.advantageMode = input.advantageMode;
  }
  if (input.stack !== undefined) {
    if (typeof input.stack !== "number" || !Number.isInteger(input.stack) || input.stack < 1 || input.stack > 6) {
      throw new Error("stack must be an integer from 1 to 6.");
    }
    out.stack = input.stack;
  }
  return out;
}

function sanitizePayload(type: CampaignEventType, payload: unknown) {
  if (type === "condition-apply") return sanitizeConditionApply(payload);
  if (type === "condition-remove") {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Payload must be an object.");
    return { label: assertString((payload as Record<string, unknown>).label, "Condition label", 48) };
  }
  if (type === "announce") {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Payload must be an object.");
    return { message: assertString((payload as Record<string, unknown>).message, "Message", 200) };
  }
  if (type === "roll-request") {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Payload must be an object.");
    const input = payload as Record<string, unknown>;
    const kind = input.kind;
    if (kind !== "initiative" && kind !== "save" && kind !== "check" && kind !== "skill") {
      throw new Error("Roll request kind must be initiative, save, check, or skill.");
    }
    const out: Record<string, unknown> = {
      prompt: assertString(input.prompt, "Prompt", 80),
      kind,
      key: assertString(input.key, "Roll key", 40),
    };
    if (input.dc !== undefined) {
      if (typeof input.dc !== "number" || !Number.isInteger(input.dc) || input.dc < 1 || input.dc > 40) {
        throw new Error("DC must be an integer from 1 to 40.");
      }
      out.dc = input.dc;
    }
    return out;
  }
  if (type === "rest-short" || type === "rest-long") return {};
  if (type === "audio-cue" || type === "handout") {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Payload must be an object.");
    const input = payload as Record<string, unknown>;
    const url = assertString(input.url, "URL", 500);
    if (!/^https?:\/\//i.test(url)) throw new Error("URL must use http or https.");
    return { url, title: assertString(input.title, "Title", 60) };
  }
  throw new Error("Unsupported event type.");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await authenticateRequest(request);
    const { id } = await params;
    const body = await request.json();
    const type = body?.type as CampaignEventType;
    if (!EVENT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Unsupported event type." }, { status: 400 });
    }
    const targetUserId = typeof body.targetUserId === "string" && body.targetUserId.trim()
      ? body.targetUserId.trim()
      : null;
    if ((type === "condition-apply" || type === "condition-remove") && !targetUserId) {
      return NextResponse.json({ error: "Condition events require targetUserId." }, { status: 400 });
    }
    const payload = sanitizePayload(type, body.payload);
    const event = postCampaignEvent(id, userId, type, payload, targetUserId);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create event." },
      { status: error instanceof Error && error.message.includes("DM") ? 403 : 400 },
    );
  }
}
