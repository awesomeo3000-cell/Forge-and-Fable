"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dmToolsApi } from "@/lib/client/dmToolsApi";
import { resolveViewerRole, type CampaignViewerRole } from "@/lib/campaignWorkspaceModel";
import type { CampaignSection } from "@/lib/campaignRoute";
import type { Character } from "@/types/game";
import type { CampaignEvent, CampaignSyncPayload } from "@/types/campaign";
import type { CampaignSession, PlayerCampaignMemory } from "@/types/dmTools";
import CampaignWorkspace from "./CampaignWorkspace";

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

/** Active first, then scheduled soonest-first, then completed newest-first. */
function orderSessions(sessions: CampaignSession[]): CampaignSession[] {
  const at = (session: CampaignSession) => Date.parse(session.scheduledAt ?? session.startedAt);
  const rank = (session: CampaignSession) => (session.status === "active" ? 0 : session.status === "scheduled" ? 1 : 2);
  return sessions.slice().sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? at(b) - at(a) : at(a) - at(b)));
}

/**
 * Data wrapper for the campaign workspace page (campaign workspace handoff).
 * Owns the fetches and mutations the retired campaign modal used to perform —
 * sessions, player-visible memory (journal + handouts), leave/switch,
 * appearance save and campaign delete — all against the same endpoints, so
 * business logic is unchanged. The workspace itself stays presentational.
 */
export default function CampaignWorkspacePage(props: {
  detail: CampaignSyncPayload;
  characters: Character[];
  currentUserId?: string;
  campaignEvents: CampaignEvent[];
  resolvedEventIds: Set<string>;
  section: CampaignSection;
  onSectionChange: (section: CampaignSection) => void;
  onBackToList: () => void;
  /** Called after the viewer leaves or deletes the campaign. */
  onCampaignClosed: () => void;
  /** Re-arms the campaign sync (same id = refresh) after membership changes. */
  onActiveCampaignChange: (campaignId: string | null) => void;
  onOpenSheet?: (character: Character) => void;
  onCreateCharacter?: () => void;
  onRespondRollRequest: (event: CampaignEvent) => void;
  onAcceptRest: (type: CampaignEvent["type"], eventId?: string) => void;
  onRespondLoot: (event: CampaignEvent, accept: boolean) => void;
  onResolveEvent: (eventId: string) => void;
  onPostEvent: (type: CampaignEvent["type"], payload: Record<string, unknown>, targetUserId?: string | null) => Promise<boolean>;
  onOpenTable: () => void;
  onScheduleSession: () => void;
}) {
  const campaignId = props.detail.campaign.id;
  // Role is decided by the server (from the session cookie) and carried on the
  // sync payload — trusting it avoids the stale-localStorage identity mismatch
  // that made a DM's own workspace render as a player. resolveViewerRole stays
  // as the fallback when the flag is absent (older payloads / tests).
  const viewerRole: CampaignViewerRole = props.detail.viewerIsDm
    ? "dm"
    : resolveViewerRole(props.detail.campaign.dmUserId, props.currentUserId);
  const { onCampaignClosed, onActiveCampaignChange, onPostEvent } = props;

  const [sessions, setSessions] = useState<CampaignSession[]>([]);
  const [memory, setMemory] = useState<PlayerCampaignMemory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  useEffect(() => {
    let active = true;
    void dmToolsApi.listSessions(campaignId)
      .then(({ sessions: list }) => { if (active) setSessions(orderSessions(list)); })
      .catch(() => { if (active) setSessions([]); });
    return () => { active = false; };
  }, [campaignId]);

  // Journal and handouts don't ride the live sync payload — refetch when a
  // new handout event arrives so a share appears without a reload.
  const handoutEventCount = useMemo(
    () => props.campaignEvents.filter((event) => event.type === "handout").length,
    [props.campaignEvents],
  );
  useEffect(() => {
    let active = true;
    void fetch(`/api/campaigns/${campaignId}/memory`, { headers: authHeaders() })
      .then(async (response) => (response.ok ? await response.json() as PlayerCampaignMemory : null))
      .then((data) => { if (active && data) setMemory(data); })
      .catch(() => { /* modules show their empty states */ });
    return () => { active = false; };
  }, [campaignId, handoutEventCount]);

  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopiedCode(code);
        window.setTimeout(() => setCopiedCode((current) => (current === code ? "" : current)), 1600);
      })
      .catch(() => setError("Could not copy the code — copy it by hand."));
  }, []);

  const leaveCampaign = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/members/me`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) {
        setError("The campaign could not be left.");
        return;
      }
      onCampaignClosed();
    } catch {
      setError("The campaign could not be left.");
    } finally {
      setBusy(false);
    }
  }, [campaignId, onCampaignClosed]);

  const switchCharacter = useCallback(async (characterId: string) => {
    if (!characterId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/members/me`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ characterId }),
      });
      if (!response.ok) {
        setError("The character could not be linked.");
        return;
      }
      onActiveCampaignChange(campaignId);
    } catch {
      setError("The character could not be linked.");
    } finally {
      setBusy(false);
    }
  }, [campaignId, onActiveCampaignChange]);

  const saveAppearance = useCallback(async (themeKey: string, bannerImageUrl: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ themeKey, bannerImageUrl: bannerImageUrl || null }),
      });
      if (!response.ok) return false;
      onActiveCampaignChange(campaignId);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [campaignId, onActiveCampaignChange]);

  const savePlayerView = useCallback(async (input: Record<string, boolean>) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(input) });
      if (!response.ok) return false;
      onActiveCampaignChange(campaignId);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [campaignId, onActiveCampaignChange]);

  const deleteCampaign = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) {
        setError("The campaign could not be deleted.");
        return false;
      }
      onCampaignClosed();
      return true;
    } catch {
      setError("The campaign could not be deleted.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [campaignId, onCampaignClosed]);

  const postAnnouncement = useCallback(
    (message: string) => onPostEvent("announce", { message }),
    [onPostEvent],
  );

  return (
    <CampaignWorkspace
      detail={props.detail}
      characters={props.characters}
      currentUserId={props.currentUserId}
      campaignEvents={props.campaignEvents}
      resolvedEventIds={props.resolvedEventIds}
      sessions={sessions}
      memory={memory}
      viewerRole={viewerRole}
      section={props.section}
      onSectionChange={props.onSectionChange}
      copiedCode={copiedCode}
      onCopyCode={copyCode}
      onBackToList={props.onBackToList}
      onOpenSheet={props.onOpenSheet}
      onCreateCharacter={props.onCreateCharacter}
      onSwitchCharacter={(characterId) => void switchCharacter(characterId)}
      onLeave={() => void leaveCampaign()}
      onRespondRollRequest={props.onRespondRollRequest}
      onAcceptRest={props.onAcceptRest}
      onRespondLoot={props.onRespondLoot}
      onResolveEvent={props.onResolveEvent}
      onPostAnnouncement={viewerRole === "dm" ? postAnnouncement : undefined}
      onOpenTable={props.onOpenTable}
      onSavePlayerView={viewerRole === "dm" ? savePlayerView : undefined}
      onScheduleSession={viewerRole === "dm" ? props.onScheduleSession : undefined}
      onSaveAppearance={viewerRole === "dm" ? saveAppearance : undefined}
      onDeleteCampaign={viewerRole === "dm" ? deleteCampaign : undefined}
      busy={busy}
      error={error}
    />
  );
}
