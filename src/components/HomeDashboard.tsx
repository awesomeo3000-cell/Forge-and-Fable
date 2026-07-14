"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Swords, Users } from "lucide-react";
import type { CampaignSummary } from "@/lib/campaignStore";
import type { Character, Ruleset } from "@/types/game";
import type { CampaignEvent, CampaignSyncPayload } from "@/types/campaign";

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
  onResumeCampaign: (campaignId: string) => void;
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
  onResumeCampaign,
  onOpenCampaigns,
  onOpenCharacter,
  onCreateCharacter,
}: Props) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
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

  const recentEvents = useMemo(
    () => (campaignSync ? campaignEvents.slice(-3).reverse() : []),
    [campaignSync, campaignEvents],
  );

  const heroLine = (character: Character) => {
    const race = ruleset?.races.find((item) => item.id === character.raceId)?.name;
    const heroClass = ruleset?.classes.find((item) => item.id === character.classId)?.name;
    return [race, heroClass, `Level ${character.level}`].filter(Boolean).join(" · ");
  };

  return (
    <div className="ao-home" aria-label="Campaign observatory home">
      <header className="ao-home-heading">
        <div>
          <span className="ao-dash-eyebrow">Campaign observatory</span>
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

      <section className="ao-home-hero" aria-labelledby="ao-home-hero-title">
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
            <h2 id="ao-home-hero-title" className="ao-home-hero-quiet">Consulting the charts…</h2>
          ) : (
            <>
              <h2 id="ao-home-hero-title">No campaign on the meridian</h2>
              <p className="ao-home-hero-blurb">Create a campaign to run as DM, or join a table with a code from your Dungeon Master.</p>
              <div className="ao-home-hero-actions">
                <button className="dj-btn dj-btn-primary" type="button" onClick={onOpenCampaigns}><Plus size={16} /> New campaign</button>
                <button className="dj-btn" type="button" onClick={onOpenCampaigns}><Users size={16} /> Join with a code</button>
              </div>
            </>
          )}
        </div>
        <div className="ao-home-orrery" aria-hidden="true" />
      </section>

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
                    <span className="ao-home-avatar" aria-hidden="true">{character.name.trim().charAt(0).toUpperCase() || "?"}</span>
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
