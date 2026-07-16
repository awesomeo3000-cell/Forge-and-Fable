"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, ChevronRight, Clock3, Download, KeyRound, MapPin, Swords } from "lucide-react";
import type { CampaignSummary } from "@/lib/campaignStore";
import type { Character, Ruleset } from "@/types/game";
import type { CampaignEvent, CampaignSyncPayload } from "@/types/campaign";
import type { CampaignSession } from "@/types/dmTools";
import { dmToolsApi } from "@/lib/client/dmToolsApi";
import {
  dashboardActions,
  dashboardGreeting,
  deriveAttention,
  featuredCampaign,
  resolveDashboardContext,
  type DashboardActionId,
} from "@/lib/dashboardContext";
import DashboardActionGrid from "@/components/dashboard/DashboardActionGrid";
import ActiveCampaignFeature, { type CampaignFeatureMeta } from "@/components/dashboard/ActiveCampaignFeature";
import DashboardCharacters from "@/components/dashboard/DashboardCharacters";

/**
 * Context-aware home dashboard (dashboard handoff): the first screen after
 * login for every account. HomeDashboard reads existing account data, resolves
 * context with the pure dashboardContext model, orders the modules, and passes
 * data into presentation components. Every action delegates to an existing
 * ForgeAndFableApp handler; no character or campaign business logic lives here.
 */

type Props = {
  userName: string;
  characters: Character[];
  ruleset: Ruleset | null;
  activeCampaignId: string | null;
  campaignSync: CampaignSyncPayload | null;
  campaignEvents: CampaignEvent[];
  /** Bumped by the parent when a panel closes so a freshly scheduled session
   *  is refetched into the Next Session module. */
  refreshKey?: number;
  onResumeCampaign: (campaignId: string) => void;
  onScheduleSession: (campaignId: string) => void;
  onOpenCampaigns: () => void;
  onOpenCharacter: (characterId: string) => void;
  onCreateCharacter: () => void;
  onImportCharacter: () => void;
};

function eventHeadline(event: CampaignEvent): string {
  try {
    const payload = JSON.parse(event.payload) as Record<string, unknown>;
    if (event.type === "announce" && typeof payload.message === "string") return payload.message;
    if (event.type === "roll-request") return "The DM requested a roll.";
    if (event.type === "rest-short") return "A short rest was called.";
    if (event.type === "rest-long") return "A long rest was called.";
    if (event.type === "loot-offer") return `Loot offered: ${typeof payload.name === "string" ? payload.name : "an item"}.`;
    if (event.type === "handout") return `A handout was shared: ${typeof payload.title === "string" ? payload.title : "untitled"}.`;
  } catch { /* fall through to the generic line */ }
  return "Something stirred at the table.";
}

export default memo(function HomeDashboard(props: Props) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [nextSession, setNextSession] = useState<CampaignSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/campaigns", { headers: { "Content-Type": "application/json" } });
        if (!response.ok) { if (!cancelled) setCampaigns([]); return; }
        const data = await response.json() as { campaigns?: CampaignSummary[] };
        if (!cancelled) setCampaigns(data.campaigns ?? []);
      } catch {
        if (!cancelled) setCampaigns([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const campaignsReady = useMemo(() => campaigns ?? [], [campaigns]);
  const featured = useMemo(
    () => featuredCampaign(campaignsReady, props.activeCampaignId),
    [campaignsReady, props.activeCampaignId],
  );

  useEffect(() => {
    let cancelled = false;
    setNextSession(null);
    if (!featured?.id) return () => { cancelled = true; };
    void dmToolsApi.listSessions(featured.id)
      .then(({ sessions }) => {
        const upcoming = sessions
          .filter((session) => session.status === "scheduled" && Date.parse(session.scheduledAt ?? session.startedAt) > Date.now())
          .sort((a, b) => Date.parse(a.scheduledAt ?? a.startedAt) - Date.parse(b.scheduledAt ?? b.startedAt));
        if (!cancelled) setNextSession(upcoming[0] ?? null);
      })
      .catch(() => { if (!cancelled) setNextSession(null); });
    return () => { cancelled = true; };
  }, [featured?.id, props.refreshKey]);

  const context = useMemo(
    () => resolveDashboardContext({ characters: props.characters, campaigns: campaignsReady }),
    [props.characters, campaignsReady],
  );
  const signals = useMemo(
    () => ({
      userName: props.userName,
      characters: props.characters,
      campaigns: campaignsReady,
      activeCampaignId: props.activeCampaignId,
      hasUpcomingSession: Boolean(nextSession),
    }),
    [props.userName, props.characters, campaignsReady, props.activeCampaignId, nextSession],
  );
  const greeting = useMemo(() => dashboardGreeting(context, signals), [context, signals]);
  const actions = useMemo(() => dashboardActions(context, signals), [context, signals]);
  const attention = useMemo(() => deriveAttention(props.characters).slice(0, 4), [props.characters]);

  const lastCharacter = props.characters[0] ?? null;

  // Every action id resolves to an existing app handler. Campaign-hub actions
  // (start/join/manage) route to the campaign panel, which owns those flows.
  const runAction = (id: DashboardActionId) => {
    switch (id) {
      case "create-character": props.onCreateCharacter(); break;
      case "continue-character": if (lastCharacter) props.onOpenCharacter(lastCharacter.id); else props.onCreateCharacter(); break;
      case "import-character": props.onImportCharacter(); break;
      case "open-campaign":
      case "next-session":
      case "review-party": if (featured) props.onResumeCampaign(featured.id); else props.onOpenCampaigns(); break;
      case "prepare-session":
        if (featured) { if (featured.myRole === "dm" && !nextSession) props.onScheduleSession(featured.id); else props.onResumeCampaign(featured.id); }
        else props.onOpenCampaigns();
        break;
      case "start-campaign":
      case "join-campaign":
      case "manage-campaigns": props.onOpenCampaigns(); break;
    }
  };

  const sessionDate = nextSession ? new Date(nextSession.scheduledAt ?? nextSession.startedAt) : null;
  const sessionTimeLabel = sessionDate
    ? `${sessionDate.toLocaleDateString([], { weekday: "long" })} at ${sessionDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : null;

  const partyMembers = (props.campaignSync?.members ?? []).filter((member) => !member.isGhost);
  const readyMembers = partyMembers.filter((member) => member.characterId).length;
  const readinessValue = partyMembers.length > 0 ? `${readyMembers} of ${partyMembers.length} ready` : "Awaiting party";

  // Welcome banner actions vary by context; all reuse the same handlers.
  const welcome = ((): { primaryLabel: string; onPrimary: () => void; secondaryLabel: string; onSecondary: () => void } => {
    if (context === "new") {
      return { primaryLabel: "Create a Character", onPrimary: props.onCreateCharacter, secondaryLabel: "Join a Campaign", onSecondary: props.onOpenCampaigns };
    }
    if (context === "dm") {
      return {
        primaryLabel: featured ? `Open ${featured.name}` : "Open a Campaign",
        onPrimary: () => (featured ? props.onResumeCampaign(featured.id) : props.onOpenCampaigns()),
        secondaryLabel: "Prepare Next Session",
        onSecondary: () => (featured ? (featured.myRole === "dm" && !nextSession ? props.onScheduleSession(featured.id) : props.onResumeCampaign(featured.id)) : props.onOpenCampaigns()),
      };
    }
    if (context === "mixed") {
      return {
        primaryLabel: featured ? `Open ${featured.name}` : "Open a Campaign",
        onPrimary: () => (featured ? props.onResumeCampaign(featured.id) : props.onOpenCampaigns()),
        secondaryLabel: lastCharacter ? `Continue ${lastCharacter.name}` : "Create a Character",
        onSecondary: () => (lastCharacter ? props.onOpenCharacter(lastCharacter.id) : props.onCreateCharacter()),
      };
    }
    return {
      primaryLabel: lastCharacter ? `Continue ${lastCharacter.name}` : "Create a Character",
      onPrimary: () => (lastCharacter ? props.onOpenCharacter(lastCharacter.id) : props.onCreateCharacter()),
      secondaryLabel: "Create Another Character",
      onSecondary: props.onCreateCharacter,
    };
  })();

  const featureMeta: CampaignFeatureMeta[] = featured
    ? [
        { label: "Next session", value: sessionTimeLabel ?? "Not scheduled" },
        { label: "Party", value: readinessValue },
        { label: "Your role", value: featured.myRole === "dm" ? "Dungeon Master" : "Player" },
      ]
    : [];

  const campaignByCharacter = useMemo(() => {
    const map: Record<string, string> = {};
    for (const campaign of campaignsReady) {
      if (campaign.myCharacterId) map[campaign.myCharacterId] = campaign.name;
    }
    return map;
  }, [campaignsReady]);

  const recentEvents = useMemo(
    () => (props.campaignSync ? props.campaignEvents.slice(-4).reverse() : []),
    [props.campaignSync, props.campaignEvents],
  );

  return (
    <div className="ao-hd" aria-label="Home">
      {/* 1. Welcome banner */}
      <section className="ao-hd-welcome" aria-labelledby="ao-hd-welcome-title">
        <div className="ao-hd-welcome-copy">
          <span className="ao-dash-eyebrow">{greeting.kicker}</span>
          <h1 id="ao-hd-welcome-title">{greeting.title}</h1>
          <p>{greeting.text}</p>
          <div className="ao-hd-feature-actions">
            <button className="ao-hd-btn ao-hd-btn-primary" type="button" onClick={welcome.onPrimary}>
              {welcome.primaryLabel}
            </button>
            <button className="ao-hd-btn" type="button" onClick={welcome.onSecondary}>
              {welcome.secondaryLabel}
            </button>
          </div>
        </div>
        <div className="ao-hd-welcome-art" aria-hidden="true" />
      </section>

      {/* 2. Context-aware action cards */}
      <DashboardActionGrid heading={greeting.heading} subhead={greeting.subhead} actions={actions} onAction={runAction} />

      {/* 3. Active campaign feature + supporting session/attention panels */}
      <div className="ao-hd-grid">
        <ActiveCampaignFeature
          campaign={featured}
          loading={campaigns === null}
          isActive={Boolean(featured && featured.id === props.activeCampaignId)}
          meta={featureMeta}
          primaryLabel={featured?.myRole === "dm" ? "Prepare Session" : "Open Campaign"}
          secondaryLabel={featured?.myCharacterName ? `Open ${featured.myCharacterName}` : "Open Campaign"}
          onPrimary={() => featured && (featured.myRole === "dm" && !nextSession ? props.onScheduleSession(featured.id) : props.onResumeCampaign(featured.id))}
          onSecondary={() => {
            if (!featured) return;
            const linked = featured.myCharacterId;
            if (linked && props.characters.some((c) => c.id === linked)) props.onOpenCharacter(linked);
            else props.onResumeCampaign(featured.id);
          }}
          onStartCampaign={props.onOpenCampaigns}
          onJoinCampaign={props.onOpenCampaigns}
        />

        <div className="ao-hd-stack">
          <section className="ao-hd-panel" aria-labelledby="ao-hd-session-title">
            <div className="ao-hd-panel-head">
              <h2 id="ao-hd-session-title">Next Session</h2>
            </div>
            {nextSession && sessionDate ? (
              <div className="ao-hd-session-row">
                <span className="ao-hd-row-icon" aria-hidden="true"><CalendarDays size={16} /></span>
                <span className="ao-hd-row-main">
                  <strong>{sessionTimeLabel}</strong>
                  <span>{nextSession.title ?? featured?.name ?? "Your next adventure"}</span>
                  {nextSession.location ? <span><MapPin size={12} aria-hidden="true" /> {nextSession.location}</span> : null}
                </span>
                <button className="ao-hd-row-action" type="button" onClick={() => featured && props.onResumeCampaign(featured.id)}>
                  {featured?.myRole === "dm" ? "Prepare" : "View"}
                </button>
              </div>
            ) : (
              <p className="ao-hd-panel-empty">
                <Clock3 size={14} aria-hidden="true" /> No session is scheduled yet.
                {featured?.myRole === "dm" ? " Set a date from the campaign workshop." : " Your DM will schedule the next one."}
              </p>
            )}
          </section>

          <section className="ao-hd-panel" aria-labelledby="ao-hd-attention-title">
            <div className="ao-hd-panel-head">
              <h2 id="ao-hd-attention-title">Needs Attention</h2>
            </div>
            {attention.length > 0 ? (
              <ul className="ao-hd-attention-list">
                {attention.map((item) => (
                  <li key={item.id}>
                    <span className={`ao-hd-attention-dot${item.severity === "warning" ? " is-warning" : ""}`} aria-hidden="true" />
                    <span className="ao-hd-row-main">
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </span>
                    {item.characterId ? (
                      <button className="ao-hd-row-action" type="button" onClick={() => props.onOpenCharacter(item.characterId!)}>
                        Resolve
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ao-hd-panel-empty">Nothing needs attention. Active commissions and campaigns will surface here.</p>
            )}
          </section>
        </div>
      </div>

      {/* 4. Supporting: heroes, activity, quick links */}
      <div className="ao-hd-lower">
        <section aria-labelledby="ao-hd-heroes-title">
          <div className="ao-hd-section-head">
            <div><h2 id="ao-hd-heroes-title">Your Heroes</h2><p>Characters you can open or continue.</p></div>
          </div>
          <DashboardCharacters
            characters={props.characters}
            ruleset={props.ruleset}
            campaignByCharacter={campaignByCharacter}
            onOpenCharacter={props.onOpenCharacter}
            onCreateCharacter={props.onCreateCharacter}
            onImportCharacter={props.onImportCharacter}
          />
        </section>

        <section aria-labelledby="ao-hd-activity-title">
          <div className="ao-hd-section-head">
            <div><h2 id="ao-hd-activity-title">Recent Activity</h2><p>What changed across your stories.</p></div>
          </div>
          <div className="ao-hd-panel">
            {recentEvents.length === 0 ? (
              <p className="ao-hd-panel-empty">
                <BookOpen size={14} aria-hidden="true" /> The table is quiet. Activity from your active campaign appears here.
              </p>
            ) : (
              <ul className="ao-hd-activity-list">
                {recentEvents.map((event) => (
                  <li key={event.id}>
                    <span className="ao-hd-activity-dot" data-type={event.type} aria-hidden="true" />
                    <span>{eventHeadline(event)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="ao-hd-links-title">
          <div className="ao-hd-section-head">
            <div><h2 id="ao-hd-links-title">Quick Links</h2><p>Secondary tools and destinations.</p></div>
          </div>
          <nav className="ao-hd-panel ao-hd-links">
            <button type="button" className="ao-hd-link-row" onClick={props.onOpenCampaigns}>
              <span className="ao-hd-row-icon" aria-hidden="true"><Swords size={15} /></span>
              <span className="ao-hd-row-main"><strong>Browse Campaigns</strong><span>Open, create or join a table</span></span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
            <button type="button" className="ao-hd-link-row" onClick={props.onImportCharacter}>
              <span className="ao-hd-row-icon" aria-hidden="true"><Download size={15} /></span>
              <span className="ao-hd-row-main"><strong>Import Character</strong><span>Bring in an existing hero</span></span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
            <button type="button" className="ao-hd-link-row" onClick={props.onOpenCampaigns}>
              <span className="ao-hd-row-icon" aria-hidden="true"><KeyRound size={15} /></span>
              <span className="ao-hd-row-main"><strong>Join with a Code</strong><span>Enter a code from your DM</span></span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </nav>
        </section>
      </div>
    </div>
  );
});
