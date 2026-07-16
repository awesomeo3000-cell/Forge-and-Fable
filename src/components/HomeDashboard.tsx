"use client";

import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { BookOpen, CalendarDays, Check, ChevronRight, Clock3, MapPin, Plus, Swords, Users } from "lucide-react";
import type { CampaignSummary } from "@/lib/campaignStore";
import { getCampaignTheme } from "@/lib/campaignThemes";
import type { Character, Ruleset } from "@/types/game";
import type { CampaignEvent, CampaignSyncPayload } from "@/types/campaign";
import type { CampaignSession } from "@/types/dmTools";
import { dmToolsApi } from "@/lib/client/dmToolsApi";
import CharacterPortrait from "@/components/portraits/CharacterPortrait";

/**
 * The Home screen (AO-6): the observatory landing page from the approved
 * mockup — hero campaign panel, party roster, quick actions, live table
 * notifications. Composition only: every action delegates to existing
 * ForgeAndFableApp handlers, and every panel renders only data that exists.
 */

type Props = {
  userName: string;
  characters: Character[];
  ruleset: Ruleset | null;
  activeCampaignId: string | null;
  campaignSync: CampaignSyncPayload | null;
  campaignEvents: CampaignEvent[];
  /** Bumped by the parent when the campaign/workshop panel closes, so a
   *  freshly scheduled session is refetched into the Next session module. */
  refreshKey?: number;
  onResumeCampaign: (campaignId: string) => void;
  onScheduleSession: (campaignId: string) => void;
  onOpenCampaigns: () => void;
  onOpenCharacter: (characterId: string) => void;
  onCreateCharacter: () => void;
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

export default memo(function HomeDashboard({
  userName,
  characters,
  ruleset,
  activeCampaignId,
  campaignSync,
  campaignEvents,
  refreshKey,
  onResumeCampaign,
  onScheduleSession,
  onOpenCampaigns,
  onOpenCharacter,
  onCreateCharacter,
}: Props) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [nextSession, setNextSession] = useState<CampaignSession | null>(null);
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 5 ? "Burning the midnight oil" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

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

  const featured = useMemo(() => {
    if (!campaigns || campaigns.length === 0) return null;
    return campaigns.find((c) => c.id === activeCampaignId) ?? campaigns[0];
  }, [campaigns, activeCampaignId]);

  const featuredTheme = getCampaignTheme(featured?.themeKey);

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
  }, [featured?.id, refreshKey]);

  const recentEvents = useMemo(
    () => (campaignSync ? campaignEvents.slice(-3).reverse() : []),
    [campaignSync, campaignEvents],
  );

  const partyMembers = useMemo(
    () => (campaignSync?.members ?? []).filter((member) => !member.isGhost).slice(0, 4),
    [campaignSync],
  );
  const readyMembers = partyMembers.filter((member) => member.characterId).length;
  const readinessLabel = partyMembers.length > 0
    ? `${readyMembers} of ${partyMembers.length} ready`
    : nextSession ? "Party check-in" : "No session scheduled";

  const sessionDate = nextSession ? new Date(nextSession.scheduledAt ?? nextSession.startedAt) : null;
  const sessionDateLabel = sessionDate
    ? sessionDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : "Plan the next session";
  const sessionTimeLabel = sessionDate
    ? `${sessionDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${new Date(sessionDate.getTime() + (nextSession?.durationMinutes ?? 180) * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "Choose a date and time in the campaign workshop";
  const daysUntilSession = sessionDate ? Math.max(0, Math.ceil((sessionDate.getTime() - Date.now()) / 86400000)) : null;
  const sessionCountdown = daysUntilSession === null ? "Awaiting a date" : daysUntilSession === 0 ? "Today" : daysUntilSession === 1 ? "Tomorrow" : `In ${daysUntilSession} days`;

  const heroLine = (character: Character) => {
    const race = ruleset?.races.find((item) => item.id === character.raceId)?.name;
    const heroClass = ruleset?.classes.find((item) => item.id === character.classId)?.name;
    return [race, heroClass, `Level ${character.level}`].filter(Boolean).join(" · ");
  };

  return (
    <div className="ao-home" aria-label="Home">
      <header className="ao-home-heading">
        <div>
          <span className="ao-dash-eyebrow">Your table</span>
          <h1>{greeting}, {userName}.</h1>
          <p>Your table, your heroes and your campaigns, gathered in one place.</p>
        </div>
        <div className="ao-home-heading-actions">
          {featured ? (
            <button className="dj-btn dj-btn-primary" type="button" onClick={() => onResumeCampaign(featured.id)}>
              <Swords size={16} /> {featured.myRole === "dm" ? "Open the Table" : "Resume campaign"}
            </button>
          ) : (
            <button className="dj-btn dj-btn-primary" type="button" onClick={onCreateCharacter}>
              <Plus size={16} /> Create a character
            </button>
          )}
        </div>
      </header>

      <section
        className="ao-home-hero"
        aria-labelledby="ao-home-hero-title"
        data-campaign-theme={featuredTheme.id}
        style={{ "--campaign-art": `url("${(featured?.bannerImageUrl || featuredTheme.imageUrl).replace(/["\\)]/g, "")}")` } as CSSProperties}
      >
        <div className="ao-home-hero-copy">
          <span className="ao-dash-eyebrow">{featured && featured.id === activeCampaignId ? "Current campaign" : "Most recent campaign"}</span>
          {featured ? (
            <>
              <h2 id="ao-home-hero-title">{featured.name}</h2>
              <p className="ao-home-hero-meta">
                <span className="ao-dash-role-chip" data-role={featured.myRole}>{featured.myRole === "dm" ? "DM" : "Player"}</span>
                <span>{featured.memberCount} member{featured.memberCount === 1 ? "" : "s"}</span>
                {featured.myCharacterName ? <span>Playing as {featured.myCharacterName}</span> : null}
                <span className="campaign-code-badge">Code: {featured.code}</span>
              </p>
              <div className="ao-home-hero-actions">
                <button className="dj-btn dj-btn-primary" type="button" onClick={() => onResumeCampaign(featured.id)}>
                  {featured.myRole === "dm" ? "Open the Table" : "Resume campaign"}
                </button>
                <button className="dj-btn" type="button" onClick={onOpenCampaigns}>All campaigns</button>
              </div>
            </>
          ) : campaigns === null ? (
            <h2 id="ao-home-hero-title" className="ao-home-hero-quiet">Opening the tome…</h2>
          ) : (
            <>
              <h2 id="ao-home-hero-title">Your table is quiet</h2>
              <p className="ao-home-hero-blurb">Create a campaign to run as DM, or join a table with a code from your Dungeon Master.</p>
              <div className="ao-home-hero-actions">
                <button className="dj-btn dj-btn-primary" type="button" onClick={onOpenCampaigns}><Plus size={16} /> New campaign</button>
                <button className="dj-btn" type="button" onClick={onOpenCampaigns}><Users size={16} /> Join with a code</button>
              </div>
            </>
          )}
        </div>
        <div className="ao-home-hero-art" aria-hidden="true" />
      </section>

      <div className="ao-home-widget-row">
        <section className="ao-home-panel ao-home-session-panel" aria-labelledby="ao-home-session-title">
          <header className="ao-home-widget-header">
            <div>
              <span className="ao-dash-eyebrow">Next session</span>
              <h2 id="ao-home-session-title">{sessionDateLabel}</h2>
            </div>
            <span className="ao-home-widget-badge">{sessionCountdown}</span>
          </header>
          {nextSession && sessionDate ? (
            <div className="ao-home-session-body">
              <div className="ao-home-calendar-date" aria-hidden="true">
                <span>{sessionDate.toLocaleDateString([], { month: "short" }).toUpperCase()}</span>
                <strong>{sessionDate.getDate()}</strong>
                <small>{sessionDate.toLocaleDateString([], { weekday: "long" })}</small>
              </div>
              <div className="ao-home-session-copy">
                <strong>{nextSession.title ?? featured?.name ?? "Your next adventure"}</strong>
                <span><Clock3 size={14} /> {sessionTimeLabel}</span>
                {nextSession.location ? <span><MapPin size={14} /> {nextSession.location}</span> : null}
                <p>{featured?.name ?? "Your campaign"} is ready when the party is.</p>
              </div>
            </div>
          ) : (
            <div className="ao-home-session-empty">
              <CalendarDays size={22} aria-hidden="true" />
              <strong>No session scheduled yet</strong>
              <span>{featured?.myRole === "dm" ? "Set a date and time from the campaign workshop." : "Your Dungeon Master has not set the next session yet."}</span>
            </div>
          )}
          <footer className="ao-home-widget-footer">
            <span className="ao-home-readiness-label"><Check size={14} /> {readinessLabel}</span>
            <button className="dj-btn dj-btn-primary" type="button" onClick={() => featured ? (featured.myRole === "dm" && !nextSession ? onScheduleSession(featured.id) : onResumeCampaign(featured.id)) : onOpenCampaigns()}>
              {featured?.myRole === "dm" && !nextSession ? "Schedule a session" : featured ? "Open the Table" : "Plan a campaign"} <ChevronRight size={14} />
            </button>
          </footer>
        </section>

        <section className="ao-home-panel ao-home-readiness-panel" aria-labelledby="ao-home-readiness-title">
          <header className="ao-home-widget-header">
            <div>
              <span className="ao-dash-eyebrow">Party readiness</span>
              <h2 id="ao-home-readiness-title">Who&apos;s ready?</h2>
            </div>
            <CalendarDays size={18} aria-hidden="true" className="ao-home-widget-header-icon" />
          </header>
          {partyMembers.length > 0 ? (
            <ul className="ao-home-readiness-list">
              {partyMembers.map((member) => (
                <li key={member.userId}>
                  <span className="ao-home-readiness-avatar" aria-hidden="true">{member.userName.trim().charAt(0).toUpperCase() || "?"}</span>
                  <span className="ao-home-readiness-copy">
                    <strong>{member.characterName ?? member.userName}</strong>
                    <small>{member.characterName ? `${member.userName} · Level ${member.characterLevel ?? 1}` : "Character not assigned"}</small>
                  </span>
                  <span className={`ao-home-readiness-state${member.characterId ? " is-ready" : ""}`}>
                    {member.characterId ? "Ready" : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="ao-home-readiness-empty">
              <strong>Readiness appears here</strong>
              <span>Open a campaign to see character assignments and session prep.</span>
            </div>
          )}
          <button className="ao-home-text-action" type="button" onClick={onOpenCampaigns}>
            View campaign roster <ChevronRight size={14} />
          </button>
        </section>
      </div>

      <div className="ao-home-lower">
        <section className="ao-home-panel" aria-labelledby="ao-home-party-title">
          <header className="ao-home-panel-header">
            <h2 id="ao-home-party-title">Your heroes</h2>
            <button className="dj-btn ao-home-panel-action" type="button" onClick={onCreateCharacter}><Plus size={14} /> New</button>
          </header>
          {characters.length === 0 ? (
            <p className="ao-home-quiet">The roster is empty. Commission your first adventurer.</p>
          ) : (
            <ul className="ao-home-party">
              {characters.slice(0, 5).map((character) => (
                <li key={character.id}>
                  <button type="button" onClick={() => onOpenCharacter(character.id)}>
                  <CharacterPortrait
                    portraitId={character.portraitUrl || null}
                    characterName={character.name}
                    size={52}
                    shape="rounded"
                    decorative
                    className="ao-home-avatar"
                  />
                    <span className="ao-home-party-copy">
                      <strong>{character.name}</strong>
                      <small>{heroLine(character)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ao-home-panel" aria-labelledby="ao-home-actions-title">
          <header className="ao-home-panel-header">
            <h2 id="ao-home-actions-title">Quick actions</h2>
          </header>
          <div className="ao-home-quick">
            <button type="button" onClick={onCreateCharacter}>
              <Plus className="ao-home-quick-icon" size={18} />
              <strong>Create a character</strong>
              <span>Standard, quickbuilder or premade</span>
            </button>
            <button type="button" onClick={onOpenCampaigns}>
              <Swords className="ao-home-quick-icon" size={18} />
              <strong>Manage campaigns</strong>
              <span>Create, join or open a table</span>
            </button>
            <button type="button" onClick={onOpenCampaigns}>
              <Users className="ao-home-quick-icon" size={18} />
              <strong>Invite players</strong>
              <span>Share your campaign code</span>
            </button>
            <button type="button" onClick={() => (featured ? onResumeCampaign(featured.id) : onOpenCampaigns())}>
              <BookOpen className="ao-home-quick-icon" size={18} />
              <strong>{featured ? (featured.myRole === "dm" ? "Open the Table" : "Resume campaign") : "Join a campaign"}</strong>
              <span>{featured ? "Jump back into your game" : "Enter a code from your DM"}</span>
            </button>
          </div>
        </section>

        <section className="ao-home-panel" aria-labelledby="ao-home-activity-title">
          <header className="ao-home-panel-header">
            <h2 id="ao-home-activity-title">At the table</h2>
            {campaignSync ? <small>{campaignSync.campaign.name}</small> : null}
          </header>
          {recentEvents.length === 0 ? (
            <p className="ao-home-quiet">
              <BookOpen size={15} aria-hidden="true" /> The table is quiet. Activity from your active campaign appears here.
            </p>
          ) : (
            <ul className="ao-home-activity">
              {recentEvents.map((event) => (
                <li key={event.id}>
                  <span className="ao-home-activity-dot" data-type={event.type} aria-hidden="true" />
                  <span>{eventHeadline(event)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
});
