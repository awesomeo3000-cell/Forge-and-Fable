"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  MapPin,
  MoreHorizontal,
  PenLine,
  Scroll,
  ScrollText,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import CharacterPortrait from "@/components/portraits/CharacterPortrait";
import CampaignMemoryPanel from "@/components/CampaignMemoryPanel";
import { getCampaignTheme } from "@/lib/campaignThemes";
import { describeRollRequest, summarizeRollRequest } from "@/lib/rollRequest";
import type { Character } from "@/types/game";
import type { CampaignEvent, CampaignSyncPayload } from "@/types/campaign";
import type { CampaignSession, PlayerCampaignMemory } from "@/types/dmTools";
import type { CampaignSection } from "@/lib/campaignRoute";
import {
  relativeTime,
  selectActiveSession,
  selectActivity,
  selectAnnouncements,
  selectAttentionItems,
  selectBriefingContent,
  selectHandouts,
  selectMyCharacter,
  selectNextSession,
  selectObjectives,
  selectParty,
  selectReadiness,
  type CampaignViewerRole,
  type HandoutView,
} from "@/lib/campaignWorkspaceModel";
import CampaignPartyGrid from "./CampaignPartyGrid";
import CampaignSettingsSection from "./CampaignSettingsSection";
import AnnouncementComposerSheet from "./AnnouncementComposerSheet";
import ConfirmDialog from "./ConfirmDialog";

const DESCRIPTION_FALLBACK = "A campaign is underway. The next chapter is waiting.";
const BRIEFING_EXCERPT_LIMIT = 480;

const HANDOUT_ICONS: Record<HandoutView["assetType"], React.ReactNode> = {
  image: <ImageIcon size={16} aria-hidden="true" />,
  document: <FileText size={16} aria-hidden="true" />,
  url: <Link2 size={16} aria-hidden="true" />,
  text: <ScrollText size={16} aria-hidden="true" />,
};

function eventPayload(event: CampaignEvent): Record<string, unknown> {
  try {
    const parsed = JSON.parse(event.payload);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function sessionWhen(session: CampaignSession): string {
  return new Date(session.scheduledAt ?? session.startedAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" });
}

function excerpt(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

/**
 * Option C campaign workspace (campaign workspace handoff) — the shared,
 * permission-aware campaign home for players and DMs. One shell: the campaign
 * itself decides the viewer's role. Players get story, party, sessions and
 * their character; DMs additionally get attention items, the briefing
 * composer and Settings (appearance, invitations, danger zone). Live controls
 * stay at the Table (DMTablePanel) — this surface links to them but never
 * hosts them.
 */
export default function CampaignWorkspace(props: {
  detail: CampaignSyncPayload;
  characters: Character[];
  currentUserId?: string;
  campaignEvents: CampaignEvent[];
  resolvedEventIds: Set<string>;
  sessions: CampaignSession[];
  /** Player-visible campaign memory (journal, handouts). Null while loading. */
  memory: PlayerCampaignMemory | null;
  viewerRole: CampaignViewerRole;
  section: CampaignSection;
  onSectionChange: (section: CampaignSection) => void;
  copiedCode: string;
  onCopyCode: (code: string) => void;
  onBackToList: () => void;
  onOpenSheet?: (character: Character) => void;
  onCreateCharacter?: () => void;
  onSwitchCharacter: (characterId: string) => void;
  onLeave: () => void;
  onRespondRollRequest: (event: CampaignEvent) => void;
  onAcceptRest: (type: CampaignEvent["type"], eventId?: string) => void;
  onRespondLoot: (event: CampaignEvent, accept: boolean) => void;
  onResolveEvent: (eventId: string) => void;
  /* DM-only capabilities — presence implies permission (checked upstream). */
  onPostAnnouncement?: (message: string) => Promise<boolean>;
  onOpenTable?: () => void;
  onScheduleSession?: () => void;
  onSaveAppearance?: (themeKey: string, bannerImageUrl: string) => Promise<boolean>;
  onSavePlayerView?: (input: Record<string, boolean>) => Promise<boolean>;
  onDeleteCampaign?: () => Promise<boolean>;
  busy?: boolean;
  error?: string;
}) {
  const { detail, viewerRole, section } = props;
  const isDm = viewerRole === "dm";

  const [composerOpen, setComposerOpen] = useState(false);
  const [chooseCharacterOpen, setChooseCharacterOpen] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<{ id: string; name: string } | null>(null);

  // A DM without a character of their own is running the table, not failing
  // to get ready — their empty seat stays out of the party, readiness and
  // attention projections.
  const partyMembers = useMemo(
    () => detail.members.filter((member) => !(member.userId === detail.campaign.dmUserId && !member.characterId)),
    [detail.members, detail.campaign.dmUserId],
  );

  const party = useMemo(() => selectParty(partyMembers), [partyMembers]);
  const readiness = useMemo(() => selectReadiness(partyMembers), [partyMembers]);
  const myMember = useMemo(() => selectMyCharacter(detail.members, props.currentUserId), [detail.members, props.currentUserId]);
  const nextSession = useMemo(() => selectNextSession(props.sessions), [props.sessions]);
  const activeSession = useMemo(() => selectActiveSession(props.sessions), [props.sessions]);
  const briefing = useMemo(
    () => selectBriefingContent(props.campaignEvents, props.memory?.journal ?? []),
    [props.campaignEvents, props.memory?.journal],
  );
  const announcements = useMemo(() => selectAnnouncements(props.campaignEvents), [props.campaignEvents]);
  const activity = useMemo(() => selectActivity(props.campaignEvents), [props.campaignEvents]);
  const objectives = useMemo(() => selectObjectives(props.memory?.journal ?? []), [props.memory?.journal]);
  const recentHandouts = useMemo(() => selectHandouts(props.memory?.handouts ?? [], 3), [props.memory?.handouts]);
  const allHandouts = useMemo(() => selectHandouts(props.memory?.handouts ?? []), [props.memory?.handouts]);
  const attentionItems = useMemo(
    () => (isDm
      ? selectAttentionItems({ members: partyMembers, sessions: props.sessions, events: props.campaignEvents, journal: props.memory?.journal })
      : []),
    [isDm, partyMembers, props.sessions, props.campaignEvents, props.memory?.journal],
  );

  const myCharacter = useMemo(() => {
    const memberChar = detail.members.find((m) => m.userId === props.currentUserId)?.characterJson;
    if (memberChar) return memberChar;
    return props.characters.find((c) => c.id === myMember?.characterId) ?? null;
  }, [detail.members, props.characters, props.currentUserId, myMember?.characterId]);

  const openMyCharacter = () => { if (myCharacter && props.onOpenSheet) props.onOpenSheet(myCharacter); };
  const hasCharacter = Boolean(myMember?.characterId);

  const liveEvents = useMemo(
    () => props.campaignEvents
      .filter((event) =>
        !props.resolvedEventIds.has(event.id) &&
        (event.type === "roll-request" || event.type === "rest-short" || event.type === "rest-long" || event.type === "loot-offer"),
      )
      .slice()
      .reverse(),
    [props.campaignEvents, props.resolvedEventIds],
  );

  const theme = getCampaignTheme(detail.campaign.themeKey);
  const art = (detail.campaign.bannerImageUrl || theme.imageUrl).replace(/["\\)]/g, "");
  const switchable = props.characters.filter((c) => c.id !== myMember?.characterId);

  const nextSessionShort = nextSession
    ? new Date(nextSession.scheduledAt ?? nextSession.startedAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  const sections: Array<{ id: CampaignSection; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "party", label: "Party" },
    { id: "journal", label: "Journal" },
    { id: "sessions", label: "Sessions" },
    { id: "handouts", label: "Handouts" },
    { id: "activity", label: "Activity" },
    ...(isDm ? [{ id: "settings" as const, label: "Settings" }] : []),
  ];

  const goTo = (target: CampaignSection) => props.onSectionChange(target);

  const openHandout = (handout: HandoutView) => {
    if (handout.assetUrl) window.open(handout.assetUrl, "_blank", "noopener,noreferrer");
    else goTo("handouts");
  };

  /* ── Hero actions (§6.6): permission- and state-aware ── */
  const heroActions = isDm ? (
    <>
      <button className="ao-cw-btn ao-cw-btn-primary" type="button" onClick={props.onOpenTable}>
        {activeSession ? "Open DM Screen" : "Prepare Session"}
      </button>
      {nextSession ? (
        <button className="ao-cw-btn" type="button" onClick={() => goTo("sessions")}>View Next Session</button>
      ) : (
        <button className="ao-cw-btn" type="button" onClick={props.onScheduleSession}>Schedule Session</button>
      )}
    </>
  ) : (
    <>
      {hasCharacter ? (
        <button className="ao-cw-btn ao-cw-btn-primary" type="button" onClick={openMyCharacter}>
          {activeSession ? "Join the Table" : "Open My Character"}
        </button>
      ) : (
        <button className="ao-cw-btn ao-cw-btn-primary" type="button" onClick={() => setChooseCharacterOpen(true)}>Choose a Character</button>
      )}
      {hasCharacter ? (
        <button className="ao-cw-btn" type="button" onClick={() => goTo("sessions")}>
          {nextSession ? "View Next Session" : "View Sessions"}
        </button>
      ) : (
        <button className="ao-cw-btn" type="button" onClick={props.onCreateCharacter}>Commission a New Character</button>
      )}
      {detail.campaign.playerDmViewEnabled ? <button className="ao-cw-btn" type="button" onClick={props.onOpenTable}>Open shared table view</button> : null}
    </>
  );

  return (
    <div className="ao-cw" data-campaign-theme={theme.id}>
      {/* ── Immersive identity header ── */}
      <header className="ao-cw-hero" style={{ "--campaign-art": `url("${art}")` } as CSSProperties}>
        <div className="ao-cw-hero-inner">
          <nav className="ao-cw-breadcrumb" aria-label="Breadcrumb">
            <button type="button" onClick={props.onBackToList}>Campaigns</button>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{detail.campaign.name}</span>
          </nav>
          <div className="ao-cw-hero-body">
            <div className="ao-cw-hero-copy">
              <h1>{detail.campaign.name}</h1>
              <p className="ao-cw-hero-desc">{DESCRIPTION_FALLBACK}</p>
              <div className="ao-cw-hero-chips">
                <span className="ao-dash-role-chip" data-role={isDm ? "dm" : "player"}>{isDm ? "Dungeon Master" : "Player"}</span>
                {activeSession ? <span className="ao-cw-chip ao-cw-chip-live"><span className="ao-cw-live-dot" aria-hidden="true" /> Session live</span> : null}
                {activeSession?.number ? <span className="ao-cw-chip">Session {activeSession.number}</span> : null}
                {!activeSession && nextSessionShort ? <span className="ao-cw-chip"><CalendarDays size={12} aria-hidden="true" /> Next: {nextSessionShort}</span> : null}
                <span className="ao-cw-chip">{readiness.total} member{readiness.total === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div className="ao-cw-hero-actions">
              {heroActions}
              <details className="ao-cw-overflow">
                <summary aria-label="More campaign actions"><MoreHorizontal size={18} aria-hidden="true" /></summary>
                <div className="ao-cw-overflow-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => props.onCopyCode(detail.campaign.code)}>
                    <Copy size={14} aria-hidden="true" /> {props.copiedCode === detail.campaign.code ? "Code copied" : `Copy code · ${detail.campaign.code}`}
                  </button>
                  {isDm ? (
                    <>
                      <button type="button" role="menuitem" onClick={() => goTo("settings")}>Invite players</button>
                      <button type="button" role="menuitem" onClick={() => goTo("settings")}>Appearance</button>
                      <button type="button" role="menuitem" className="ao-cw-overflow-danger" onClick={() => goTo("settings")}>Delete campaign…</button>
                    </>
                  ) : (
                    <>
                      {switchable.length > 0 ? (
                        <div className="ao-cw-overflow-switch" role="none">
                          <span>Switch character</span>
                          {switchable.map((c) => (
                            <button key={c.id} type="button" role="menuitem" onClick={() => setPendingSwitch({ id: c.id, name: c.name })}>{c.name}</button>
                          ))}
                        </div>
                      ) : null}
                      <button type="button" role="menuitem" className="ao-cw-overflow-danger" onClick={() => setPendingLeave(true)}>Leave campaign</button>
                    </>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      </header>

      {props.error ? <div className="ao-cw-error-banner" role="alert">{props.error}</div> : null}

      {/* ── Four-card status row (§7) ── */}
      <div className="ao-cw-status-grid">
        <div className="ao-cw-status-card">
          <span className="ao-cw-status-icon" aria-hidden="true"><Users size={18} /></span>
          <span className="ao-cw-status-label">Party Readiness</span>
          <strong>{readiness.ready} of {readiness.total} ready</strong>
          <button type="button" className="ao-cw-status-link" onClick={() => goTo("party")}>View party <ChevronRight size={12} aria-hidden="true" /></button>
        </div>
        {isDm ? (
          <div className="ao-cw-status-card">
            <span className="ao-cw-status-icon" aria-hidden="true"><Bell size={18} /></span>
            <span className="ao-cw-status-label">Announcements</span>
            {announcements.length > 0 ? (
              <>
                <strong>{announcements.length} recent</strong>
                <span className="ao-cw-status-sub">{excerpt(announcements[0].message, 40)}</span>
              </>
            ) : (
              <>
                <strong>None yet</strong>
                <button type="button" className="ao-cw-status-link" onClick={() => setComposerOpen(true)}>Write a briefing</button>
              </>
            )}
          </div>
        ) : (
          <div className="ao-cw-status-card">
            <span className="ao-cw-status-icon" aria-hidden="true">
              {hasCharacter ? <CharacterPortrait portraitId={myMember?.portraitId ?? null} characterName={myMember?.characterName ?? "Character"} size={30} shape="circle" decorative className="ao-cw-status-portrait" /> : <Sparkles size={18} />}
            </span>
            <span className="ao-cw-status-label">My Character</span>
            {hasCharacter ? (
              <>
                <strong>{myMember?.characterName}</strong>
                <span className="ao-cw-status-sub">Level {myMember?.characterLevel} {myMember?.characterClass}</span>
              </>
            ) : (
              <>
                <strong>No character assigned</strong>
                <button type="button" className="ao-cw-status-link" onClick={() => setChooseCharacterOpen(true)}>Choose or commission</button>
              </>
            )}
          </div>
        )}
        <div className="ao-cw-status-card">
          <span className="ao-cw-status-icon" aria-hidden="true"><CalendarDays size={18} /></span>
          <span className="ao-cw-status-label">{activeSession ? "Session" : "Next Session"}</span>
          {activeSession ? (
            <>
              <strong>Live now</strong>
              <span className="ao-cw-status-sub">{activeSession.title || (activeSession.number ? `Session ${activeSession.number}` : "At the table")}</span>
            </>
          ) : nextSession ? (
            <>
              <strong>{new Date(nextSession.scheduledAt ?? nextSession.startedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</strong>
              <span className="ao-cw-status-sub">{new Date(nextSession.scheduledAt ?? nextSession.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
            </>
          ) : (
            <>
              <strong>No session scheduled</strong>
              {isDm ? <button type="button" className="ao-cw-status-link" onClick={props.onScheduleSession}>Schedule</button> : null}
            </>
          )}
        </div>
        {isDm ? (
          <div className="ao-cw-status-card">
            <span className="ao-cw-status-icon" aria-hidden="true"><AlertTriangle size={18} /></span>
            <span className="ao-cw-status-label">Needs Attention</span>
            {attentionItems.length > 0 ? (
              <>
                <strong>{attentionItems.length} item{attentionItems.length === 1 ? "" : "s"}</strong>
                <span className="ao-cw-status-sub">{attentionItems[0].summary}</span>
              </>
            ) : (
              <strong>All clear</strong>
            )}
          </div>
        ) : (
          <div className="ao-cw-status-card">
            <span className="ao-cw-status-icon" aria-hidden="true"><Bell size={18} /></span>
            <span className="ao-cw-status-label">Announcements</span>
            {announcements.length > 0 ? (
              <>
                <strong>{announcements.length} recent</strong>
                <span className="ao-cw-status-sub">{excerpt(announcements[0].message, 40)}</span>
              </>
            ) : (
              <strong>None yet</strong>
            )}
          </div>
        )}
      </div>

      {/* ── Section navigation (§4.3) ── */}
      <nav className="ao-cw-nav" aria-label="Campaign sections">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ao-cw-nav-item${section === item.id ? " active" : ""}`}
            aria-current={section === item.id ? "page" : undefined}
            onClick={() => goTo(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {section === "overview" ? (
        <div className="ao-cw-overview">
          {!isDm && liveEvents.length > 0 ? (
            <section className="ao-cw-live-strip" aria-label="At the table">
              <span className="ao-cw-live-label"><Bell size={14} aria-hidden="true" /> At the table</span>
              <div className="ao-cw-live-events">
                {liveEvents.map((event) => {
                  const isRoll = event.type === "roll-request";
                  const desc = isRoll ? describeRollRequest(eventPayload(event)) : null;
                  return (
                    <div key={event.id} className="ao-cw-live-event">
                      <span>{isRoll ? summarizeRollRequest(eventPayload(event)) : event.type === "loot-offer" ? "Loot offered" : event.type === "rest-short" ? "Short rest called" : "Long rest called"}</span>
                      <div className="ao-cw-live-actions">
                        {isRoll ? <button type="button" className="ao-cw-btn ao-cw-btn-primary" onClick={() => props.onRespondRollRequest(event)}>{desc?.buttonLabel ?? "Roll"}</button> : null}
                        {event.type === "rest-short" || event.type === "rest-long" ? <button type="button" className="ao-cw-btn ao-cw-btn-primary" onClick={() => props.onAcceptRest(event.type, event.id)}>Apply</button> : null}
                        {event.type === "loot-offer" ? <><button type="button" className="ao-cw-btn ao-cw-btn-primary" onClick={() => props.onRespondLoot(event, true)}>Accept</button><button type="button" className="ao-cw-btn" onClick={() => props.onRespondLoot(event, false)}>Decline</button></> : null}
                        <button type="button" className="ao-cw-btn" onClick={() => props.onResolveEvent(event.id)}>Dismiss</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {!isDm && !hasCharacter ? (
            <section className="ao-cw-panel ao-cw-guidance" aria-label="Choose a character">
              <Sparkles size={18} aria-hidden="true" />
              <p>Link one of your existing characters to this campaign or begin a new commission.</p>
              <div className="ao-cw-guidance-actions">
                <button type="button" className="ao-cw-btn ao-cw-btn-primary" onClick={() => setChooseCharacterOpen(true)}>Choose Existing Character</button>
                <button type="button" className="ao-cw-btn" onClick={props.onCreateCharacter}>Commission New Character</button>
              </div>
            </section>
          ) : null}

          <div className="ao-cw-overview-primary">
            <section className="ao-cw-panel ao-cw-briefing" aria-labelledby="ao-cw-briefing-title">
              <div className="ao-cw-panel-head">
                <div>
                  <span className="ao-dash-eyebrow">{briefing?.source === "recap" ? "Where we left off" : "Latest from your DM"}</span>
                  <h3 id="ao-cw-briefing-title">Campaign Briefing</h3>
                </div>
                {isDm ? (
                  <button type="button" className="ao-cw-link" onClick={() => setComposerOpen(true)}><PenLine size={13} aria-hidden="true" /> Write a Briefing</button>
                ) : null}
              </div>
              {briefing ? (
                <>
                  {briefing.title ? <strong className="ao-cw-briefing-heading">{briefing.title}</strong> : null}
                  <p className="ao-cw-briefing-body">{excerpt(briefing.message, BRIEFING_EXCERPT_LIMIT)}</p>
                  <span className="ao-cw-briefing-meta">
                    {briefing.source === "recap" ? "Recap published" : "Announced"} {relativeTime(briefing.at)}
                    {briefing.source === "recap" ? <button type="button" className="ao-cw-link" onClick={() => goTo("journal")}>Read full recap</button> : null}
                  </span>
                </>
              ) : isDm ? (
                <p className="ao-cw-panel-empty">Give the party a clear starting point. Publish a briefing, recap or announcement.</p>
              ) : (
                <p className="ao-cw-panel-empty">No campaign briefing has been published yet. The Dungeon Master can share a campaign update here.</p>
              )}
            </section>

            <div className="ao-cw-overview-side">
              <section className="ao-cw-panel" aria-labelledby="ao-cw-objectives-title">
                <div className="ao-cw-panel-head"><h3 id="ao-cw-objectives-title"><ScrollText size={15} aria-hidden="true" /> Current Objectives</h3></div>
                {objectives.length > 0 ? (
                  <ul className="ao-cw-objectives">
                    {objectives.map((objective) => (
                      <li key={objective.id} data-status={objective.status}>
                        <span className="ao-cw-objective-mark" aria-hidden="true" />
                        <span className="ao-cw-objective-copy">
                          <strong>{objective.title}</strong>
                          {objective.body ? <small>{excerpt(objective.body, 120)}</small> : null}
                        </span>
                        <span className="ao-cw-objective-status">{objective.status === "completed" ? "Completed" : "Active"}</span>
                      </li>
                    ))}
                  </ul>
                ) : isDm ? (
                  <div className="ao-cw-panel-empty-block">
                    <p className="ao-cw-panel-empty">The party has no visible objectives. Add a quest to give the group a clear direction.</p>
                    <button type="button" className="ao-cw-link" onClick={props.onOpenTable}>Manage quests at the Table</button>
                  </div>
                ) : (
                  <p className="ao-cw-panel-empty">No objectives have been shared yet.</p>
                )}
              </section>

              {isDm ? (
                <section className="ao-cw-panel ao-cw-attention" aria-labelledby="ao-cw-attention-title">
                  <div className="ao-cw-panel-head"><h3 id="ao-cw-attention-title"><AlertTriangle size={15} aria-hidden="true" /> Needs Attention</h3></div>
                  {attentionItems.length > 0 ? (
                    <ul className="ao-cw-attention-list">
                      {attentionItems.map((item) => (
                        <li key={item.id}>
                          <span>{item.summary}</span>
                          {item.kind === "no-briefing" ? (
                            <button type="button" className="ao-cw-link" onClick={() => setComposerOpen(true)}>Write a Briefing</button>
                          ) : item.kind === "no-session" ? (
                            <button type="button" className="ao-cw-link" onClick={props.onScheduleSession}>Schedule Session</button>
                          ) : (
                            <button type="button" className="ao-cw-link" onClick={() => goTo("party")}>View Party</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ao-cw-panel-empty">The table is ready — nothing needs your attention.</p>
                  )}
                </section>
              ) : null}
            </div>
          </div>

          <section className="ao-cw-panel ao-cw-party-panel" aria-labelledby="ao-cw-party-title">
            <div className="ao-cw-panel-head">
              <h3 id="ao-cw-party-title"><Users size={15} aria-hidden="true" /> Party</h3>
              {party.length > 4 ? <button type="button" className="ao-cw-link" onClick={() => goTo("party")}>View party</button> : null}
            </div>
            {party.length > 0 ? (
              <CampaignPartyGrid members={party.slice(0, 6)} viewerUserId={props.currentUserId} onOpenMember={(m) => { const c = detail.members.find((x) => x.userId === m.userId)?.characterJson; if (c && props.onOpenSheet) props.onOpenSheet(c); }} />
            ) : (
              <p className="ao-cw-panel-empty">No players have joined this campaign yet.{isDm ? ` Share the code ${detail.campaign.code} to invite the party.` : ""}</p>
            )}
          </section>

          <div className="ao-cw-overview-secondary">
            <section className="ao-cw-panel" aria-labelledby="ao-cw-handouts-title">
              <div className="ao-cw-panel-head">
                <h3 id="ao-cw-handouts-title"><Scroll size={15} aria-hidden="true" /> Recent Handouts</h3>
                {allHandouts.length > 3 ? <button type="button" className="ao-cw-link" onClick={() => goTo("handouts")}>View all</button> : null}
              </div>
              {recentHandouts.length > 0 ? (
                <ul className="ao-cw-handout-list">
                  {recentHandouts.map((handout) => (
                    <li key={handout.id}>
                      <button type="button" className="ao-cw-handout-row" onClick={() => openHandout(handout)}>
                        <span className="ao-cw-handout-icon" aria-hidden="true">{HANDOUT_ICONS[handout.assetType]}</span>
                        <span className="ao-cw-row-main">
                          <strong>{handout.title}</strong>
                          <small>{handout.category} · {relativeTime(handout.sharedAt)}</small>
                        </span>
                        {handout.assetUrl ? <ExternalLink size={13} aria-hidden="true" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : isDm ? (
                <p className="ao-cw-panel-empty">Share a map, letter or note with the party from the Table.</p>
              ) : (
                <p className="ao-cw-panel-empty">No handouts have been shared.</p>
              )}
            </section>

            <section className="ao-cw-panel" aria-labelledby="ao-cw-session-title">
              <div className="ao-cw-panel-head"><h3 id="ao-cw-session-title">Upcoming Session</h3></div>
              {nextSession ? (
                <div className="ao-cw-session-detail">
                  <strong>{nextSession.title || (nextSession.number ? `Session ${nextSession.number}` : "Next session")}</strong>
                  <span><CalendarDays size={13} aria-hidden="true" /> {sessionWhen(nextSession)}</span>
                  {nextSession.location ? <span><MapPin size={13} aria-hidden="true" /> {nextSession.location}</span> : null}
                  {nextSession.durationMinutes ? <span><Clock3 size={13} aria-hidden="true" /> {Math.round(nextSession.durationMinutes / 60)} hour{nextSession.durationMinutes === 60 ? "" : "s"}</span> : null}
                  <button type="button" className="ao-cw-link" onClick={() => goTo("sessions")}>View all sessions</button>
                </div>
              ) : isDm ? (
                <div className="ao-cw-panel-empty-block">
                  <p className="ao-cw-panel-empty">The next session has not been scheduled.</p>
                  <button type="button" className="ao-cw-link" onClick={props.onScheduleSession}>Schedule Session</button>
                </div>
              ) : (
                <p className="ao-cw-panel-empty">No session is scheduled yet. Your Dungeon Master will schedule the next one.</p>
              )}
            </section>

            <section className="ao-cw-panel" aria-labelledby="ao-cw-activity-title">
              <div className="ao-cw-panel-head"><h3 id="ao-cw-activity-title">Activity Feed</h3></div>
              {activity.length > 0 ? (
                <ul className="ao-cw-activity">
                  {activity.map((item) => (
                    <li key={item.id}>
                      <span className="ao-cw-activity-dot" data-kind={item.kind} aria-hidden="true" />
                      <span className="ao-cw-activity-main"><span>{item.summary}</span><small>{relativeTime(item.at)}</small></span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ao-cw-panel-empty">Campaign activity will appear here as the story develops.</p>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {section === "party" ? (
        <section className="ao-cw-panel" aria-label="Party">
          <div className="ao-cw-panel-head">
            <h3><Users size={15} aria-hidden="true" /> Party ({party.length})</h3>
            {isDm ? <button type="button" className="ao-cw-link" onClick={() => goTo("settings")}>Invite players</button> : null}
          </div>
          {party.length > 0 ? (
            <CampaignPartyGrid members={party} viewerUserId={props.currentUserId} onOpenMember={(m) => { const c = detail.members.find((x) => x.userId === m.userId)?.characterJson; if (c && props.onOpenSheet) props.onOpenSheet(c); }} />
          ) : (
            <p className="ao-cw-panel-empty">No players have joined this campaign yet.{isDm ? ` Share the code ${detail.campaign.code} to invite the party.` : ""}</p>
          )}
        </section>
      ) : null}

      {section === "journal" ? (
        <div className="ao-cw-journal">
          <CampaignMemoryPanel campaignId={detail.campaign.id} />
        </div>
      ) : null}

      {section === "sessions" ? (
        <section className="ao-cw-panel" aria-label="Sessions">
          <div className="ao-cw-panel-head">
            <h3><CalendarDays size={15} aria-hidden="true" /> Sessions</h3>
            {isDm ? (
              <button type="button" className="ao-cw-btn" onClick={props.onScheduleSession}>Schedule Session</button>
            ) : (
              <span className="ao-cw-count">{props.sessions.filter((s) => s.status === "scheduled").length} scheduled</span>
            )}
          </div>
          {props.sessions.length > 0 ? (
            <ul className="ao-cw-session-list">
              {props.sessions.map((s) => (
                <li key={s.id} className="ao-cw-session-row" data-status={s.status}>
                  <span className="ao-cw-session-cal" aria-hidden="true">
                    <span>{new Date(s.scheduledAt ?? s.startedAt).toLocaleDateString([], { month: "short" }).toUpperCase()}</span>
                    <strong>{new Date(s.scheduledAt ?? s.startedAt).getDate()}</strong>
                  </span>
                  <span className="ao-cw-row-main">
                    <strong>
                      {s.title || (s.number ? `Session ${s.number}` : "Session")}
                      {s.status === "active" ? <em className="ao-cw-session-live">Live</em> : null}
                      {s.status === "completed" ? <em className="ao-cw-session-done">Completed</em> : null}
                    </strong>
                    <small>{sessionWhen(s)}</small>
                    {s.location ? <small><MapPin size={11} aria-hidden="true" /> {s.location}</small> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : isDm ? (
            <div className="ao-cw-panel-empty-block">
              <p className="ao-cw-panel-empty">The next session has not been scheduled.</p>
              <button type="button" className="ao-cw-link" onClick={props.onScheduleSession}>Schedule Session</button>
            </div>
          ) : (
            <p className="ao-cw-panel-empty">No session is scheduled yet. Your Dungeon Master will schedule the next one.</p>
          )}
        </section>
      ) : null}

      {section === "handouts" ? (
        <section className="ao-cw-panel" aria-label="Handouts">
          <div className="ao-cw-panel-head"><h3><Scroll size={15} aria-hidden="true" /> Handouts</h3><span className="ao-cw-count">{allHandouts.length} shared</span></div>
          {allHandouts.length > 0 ? (
            <ul className="ao-cw-handout-grid">
              {allHandouts.map((handout) => (
                <li key={handout.id} className="ao-cw-handout-card">
                  {handout.assetType === "image" && handout.assetUrl ? (
                    /* Handouts are arbitrary player-facing URLs; Next image optimization cannot safely whitelist them. */
                    <img src={handout.assetUrl} alt={`Handout: ${handout.title}`} loading="lazy" />
                  ) : (
                    <span className="ao-cw-handout-thumb" aria-hidden="true">{HANDOUT_ICONS[handout.assetType]}</span>
                  )}
                  <div className="ao-cw-handout-copy">
                    <strong>{handout.title}</strong>
                    <small>{handout.category} · Shared {relativeTime(handout.sharedAt)}</small>
                    {handout.description ? <p>{excerpt(handout.description, 140)}</p> : null}
                    {handout.body ? <p className="ao-cw-handout-body">{excerpt(handout.body, 280)}</p> : null}
                    {handout.assetUrl ? (
                      <a className="ao-cw-link" href={handout.assetUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={12} aria-hidden="true" /> Open {handout.assetType}
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : isDm ? (
            <p className="ao-cw-panel-empty">Share a map, letter or note with the party from the Table.</p>
          ) : (
            <p className="ao-cw-panel-empty">No handouts have been shared.</p>
          )}
        </section>
      ) : null}

      {section === "activity" ? (
        <section className="ao-cw-panel" aria-label="Activity">
          <div className="ao-cw-panel-head"><h3><Swords size={15} aria-hidden="true" /> Campaign Activity</h3></div>
          {activity.length > 0 ? (
            <ul className="ao-cw-activity">
              {activity.map((item) => (
                <li key={item.id}>
                  <span className="ao-cw-activity-dot" data-kind={item.kind} aria-hidden="true" />
                  <span className="ao-cw-activity-main"><span>{item.summary}</span><small>{relativeTime(item.at)}</small></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ao-cw-panel-empty">Campaign activity will appear here as the story develops.</p>
          )}
        </section>
      ) : null}

      {section === "settings" && isDm && props.onSaveAppearance && props.onSavePlayerView && props.onDeleteCampaign ? (
        <CampaignSettingsSection
          campaign={detail.campaign}
          busy={props.busy ?? false}
          copiedCode={props.copiedCode}
          onCopyCode={props.onCopyCode}
          onSaveAppearance={props.onSaveAppearance}
          onSavePlayerView={props.onSavePlayerView}
          onDeleteCampaign={props.onDeleteCampaign}
        />
      ) : null}

      {/* ── Focused-action sheets ── */}
      {composerOpen && props.onPostAnnouncement ? (
        <AnnouncementComposerSheet
          campaignName={detail.campaign.name}
          onSubmit={props.onPostAnnouncement}
          onClose={() => setComposerOpen(false)}
        />
      ) : null}

      {chooseCharacterOpen ? (
        <div className="modal-scrim" role="presentation" onMouseDown={() => setChooseCharacterOpen(false)}>
          <section className="ao-cw-sheet" role="dialog" aria-modal="true" aria-labelledby="ao-cw-choose-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="ao-cw-choose-title">Choose a Character</h2>
            <p className="ao-cw-sheet-hint">Link one of your characters to {detail.campaign.name}.</p>
            {props.characters.length > 0 ? (
              <ul className="ao-cw-choose-list">
                {props.characters.map((character) => (
                  <li key={character.id}>
                    <button type="button" onClick={() => { setChooseCharacterOpen(false); props.onSwitchCharacter(character.id); }}>
                      <strong>{character.name}</strong>
                      <small>Level {character.level} {character.classId}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ao-cw-panel-empty">You have no characters yet — commission one at the Forge.</p>
            )}
            <div className="ao-cw-sheet-actions">
              <button type="button" className="ao-cw-btn" onClick={() => setChooseCharacterOpen(false)}>Cancel</button>
              <button type="button" className="ao-cw-btn ao-cw-btn-primary" onClick={() => { setChooseCharacterOpen(false); props.onCreateCharacter?.(); }}>Commission New Character</button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingLeave ? (
        <ConfirmDialog
          title="Leave campaign"
          body={`Leave ${detail.campaign.name}? Your character stays in your ledger, but you will need a new invite code to return.`}
          confirmLabel="Leave campaign"
          danger
          busy={props.busy}
          onCancel={() => setPendingLeave(false)}
          onConfirm={() => { setPendingLeave(false); props.onLeave(); }}
        />
      ) : null}

      {pendingSwitch ? (
        <ConfirmDialog
          title="Switch character"
          body={`Play ${detail.campaign.name} as ${pendingSwitch.name}? The party will see your new character at the table.`}
          confirmLabel={`Switch to ${pendingSwitch.name}`}
          busy={props.busy}
          onCancel={() => setPendingSwitch(null)}
          onConfirm={() => { const id = pendingSwitch.id; setPendingSwitch(null); props.onSwitchCharacter(id); }}
        />
      ) : null}
    </div>
  );
}
