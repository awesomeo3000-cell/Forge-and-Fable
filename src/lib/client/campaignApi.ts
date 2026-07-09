import type { CampaignEvent, CampaignSyncPayload, InitiativeState } from "@/types/campaign";

const jsonHeaders: Record<string, string> = {
  "Content-Type": "application/json",
};

export async function syncCampaign(campaignId: string, since?: string) {
  const url = since
    ? `/api/campaigns/${encodeURIComponent(campaignId)}/sync?since=${encodeURIComponent(since)}`
    : `/api/campaigns/${encodeURIComponent(campaignId)}/sync`;

  const response = await fetch(url, {
    headers: jsonHeaders,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Campaign sync failed (${response.status}).`);
  }

  const data = await response.json() as CampaignSyncPayload;
  return data;
}

export async function postCampaignEvent(
  campaignId: string,
  type: CampaignEvent["type"],
  payload: Record<string, unknown>,
  targetUserId?: string | null,
) {
  const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/events`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify({ type, payload, targetUserId: targetUserId ?? null }),
  });

  const data = await response.json().catch(() => ({})) as { event?: CampaignEvent; error?: string };

  if (!response.ok || !data.event) {
    throw new Error(data.error ?? "Campaign event could not be sent.");
  }

  return data.event;
}

export async function updateCampaignInitiative(
  campaignId: string,
  data: InitiativeState,
  version: number,
) {
  const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/initiative`, {
    method: "PUT",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify({ data, version }),
  });

  const payload = await response.json().catch(() => ({})) as {
    initiative?: CampaignSyncPayload["initiative"];
    error?: string;
  };

  if (response.status === 409) {
    return { conflict: true as const };
  }

  if (!response.ok || !payload.initiative) {
    throw new Error(payload.error ?? "Initiative could not be updated.");
  }

  return { conflict: false as const, initiative: payload.initiative };
}

export async function submitCampaignInitiativeRoll(
  campaignId: string,
  initiative: number,
  characterName: string,
) {
  const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/initiative/roll`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify({ initiative, characterName }),
  });

  const payload = await response.json().catch(() => ({})) as {
    initiative?: CampaignSyncPayload["initiative"];
    error?: string;
  };

  if (!response.ok || !payload.initiative) {
    throw new Error(payload.error ?? "Initiative roll could not be shared.");
  }

  return payload.initiative;
}

/** Fire-and-forget roll sharing */
export function postCampaignRoll(
  campaignId: string,
  label: string,
  detail: string,
  total: number,
  characterName: string,
) {
  fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/rolls`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify({ label, detail, total, characterName }),
  }).catch(() => { /* fire-and-forget */ });
}
