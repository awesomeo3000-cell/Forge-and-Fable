"use client";

import { memo, useMemo } from "react";
import { AlertTriangle, Eye, HeartPulse, Sparkles, Wifi, WifiOff } from "lucide-react";
import { deriveImportantResources, memberHpState } from "@/lib/dmTable/party";
import { derivePartyAlerts } from "@/lib/dmTable/alerts";
import type { CampaignMemberSummary, CampaignPresence } from "@/types/campaign";

type Props = {
  members: CampaignMemberSummary[];
  dmUserId: string;
  selectedUserId: string | null;
  currentTurnUserId?: string | null;
  presence: CampaignPresence[];
  compact?: boolean;
  onSelect: (member: CampaignMemberSummary) => void;
  onOpenSheet: (member: CampaignMemberSummary) => void;
};

export default memo(function PartyRail({ members, dmUserId, selectedUserId, currentTurnUserId, presence, compact, onSelect, onOpenSheet }: Props) {
  const players = useMemo(() => members.filter((member) => member.userId !== dmUserId && member.characterId), [members, dmUserId]);
  const concerns = players.filter((member) => ["critical", "unconscious"].includes(memberHpState(member))).length;
  const concentrating = players.filter((member) => member.concentratingOn).length;
  const alerts = useMemo(() => derivePartyAlerts(members, presence, dmUserId), [members, presence, dmUserId]);
  const ready = players.filter((member) => ["connected", "background"].includes(presence.find((item) => item.userId === member.userId)?.state ?? "disconnected")).length;

  return (
    <aside className={`dm-command-party${compact ? " is-compact" : ""}`} aria-label="Party command center">
      <header>
        <span>Party</span>
        <strong>{players.length} adventurer{players.length === 1 ? "" : "s"}</strong>
        <small>{concerns ? `${concerns} need attention` : "Party state is steady"}{concentrating ? ` · ${concentrating} concentrating` : ""}</small>
      </header>
      {alerts.length ? <section className="dm-party-alerts" aria-label="Party alerts"><h4><AlertTriangle size={13}/> Needs attention</h4>{alerts.slice(0, 4).map((alert) => <button key={alert.id} type="button" data-severity={alert.severity} onClick={() => { const member = players.find((item) => item.userId === alert.userId); if (member) onSelect(member); }}><strong>{alert.title}</strong>{alert.detail ? <small>{alert.detail}</small> : null}</button>)}</section> : null}
      <div className="dm-command-party-list" role="listbox" aria-label="Party members">
        {players.map((member) => {
          const state = memberHpState(member);
          const percent = member.maxHp ? Math.max(0, Math.min(100, ((member.currentHp ?? 0) / member.maxHp) * 100)) : 0;
          const resources = deriveImportantResources(member).slice(0, 2);
          const selected = selectedUserId === member.userId;
          const current = currentTurnUserId === member.userId;
          const presenceState = presence.find((item) => item.userId === member.userId)?.state ?? "disconnected";
          return (
            <div key={member.userId} className={`dm-command-member is-${state}${selected ? " is-selected" : ""}${current ? " is-current" : ""}`}>
              <button type="button" role="option" aria-selected={selected} onClick={() => onSelect(member)}>
                <span className="dm-command-member-name">
                  <strong>{member.characterName ?? member.userName}</strong>
                  <small>{member.characterClass ? `${member.characterClass} ${member.characterLevel ?? ""}` : "Character not loaded"} · {presenceState}</small>
                </span>
                {!compact ? (
                  <>
                    <span className="dm-command-hp-copy">HP {member.currentHp ?? "—"} / {member.maxHp ?? "—"}{member.tempHp ? ` · +${member.tempHp} temp` : ""}</span>
                    <span className="dm-command-hp" role="progressbar" aria-label={`${member.characterName ?? member.userName} hit points`} aria-valuemin={0} aria-valuemax={member.maxHp ?? 0} aria-valuenow={member.currentHp ?? 0}>
                      <i style={{ width: `${percent}%` }} /><b>{state === "unconscious" ? "Unconscious" : state}</b>
                    </span>
                    <span className="dm-command-vitals">AC {member.ac ?? "—"} · PP {member.passivePerception ?? "—"}{member.speed ? ` · ${member.speed}` : ""}</span>
                    {member.spellSlots.length ? <span className="dm-command-slots" aria-label="Spell slots">{member.spellSlots.slice(0, 4).map((slot) => <em key={slot.level}>{slot.level}<b>{"●".repeat(slot.remaining)}{"○".repeat(Math.max(0, slot.max - slot.remaining))}</b></em>)}</span> : null}
                    {member.conditions.length || member.concentratingOn ? <span className="dm-command-tags">{member.conditions.slice(0, 3).map((condition) => <em key={condition}>{condition}</em>)}{member.concentratingOn ? <em><Sparkles size={11}/> {member.concentratingOn}</em> : null}</span> : null}
                    {member.currentHp === 0 && member.deathSaves ? <span className="dm-command-death"><HeartPulse size={12}/> Saves {member.deathSaves.successes}/3 · Fails {member.deathSaves.failures}/3</span> : null}
                    {resources.length ? <span className="dm-command-resources">{resources.map((resource) => <em key={resource.id}>{resource.shortLabel} {resource.current}/{resource.maximum}</em>)}</span> : null}
                  </>
                ) : null}
              </button>
              <button type="button" className="dm-command-open-sheet" onClick={() => onOpenSheet(member)} aria-label={`Open ${member.characterName ?? member.userName} full sheet`} disabled={!member.characterJson}><Eye size={14}/></button>
            </div>
          );
        })}
        {!players.length ? <p className="dm-command-empty">No player characters are enrolled yet.</p> : null}
      </div>
      <footer className="dm-party-readiness"><span>{ready === players.length && players.length ? <Wifi size={13}/> : <WifiOff size={13}/>} Session readiness</span><strong>{ready} of {players.length} ready</strong></footer>
    </aside>
  );
});
