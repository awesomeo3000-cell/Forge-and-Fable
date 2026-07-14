"use client";

import { memo, useMemo, useState } from "react";
import { AlertTriangle, Eye, HeartPulse, Wifi, WifiOff, X } from "lucide-react";
import { deriveImportantResources, memberHpState } from "@/lib/dmTable/party";
import { derivePartyAlerts } from "@/lib/dmTable/alerts";
import { CharacterPortrait, ConditionChip, ResourceChip, SpellSlotTrack } from "@/components/dmTable/CharacterStateVisuals";
import type { CampaignMemberSummary, CampaignPresence } from "@/types/campaign";

type Props = {
  members: CampaignMemberSummary[];
  dmUserId: string;
  selectedUserId: string | null;
  currentTurnUserId?: string | null;
  presence: CampaignPresence[];
  compact?: boolean;
  rehearsalBusy?: boolean;
  onSelect: (member: CampaignMemberSummary) => void;
  onOpenSheet: (member: CampaignMemberSummary) => void;
  onSeatRehearsal?: () => void;
  onClearRehearsal?: () => void;
};

export default memo(function PartyRail({ members, dmUserId, selectedUserId, currentTurnUserId, presence, compact, rehearsalBusy, onSelect, onOpenSheet, onSeatRehearsal, onClearRehearsal }: Props) {
  const players = useMemo(() => members.filter((member) => member.userId !== dmUserId && member.characterId), [members, dmUserId]);
  const concerns = players.filter((member) => ["critical", "unconscious"].includes(memberHpState(member))).length;
  const concentrating = players.filter((member) => member.concentratingOn).length;
  const alerts = useMemo(() => derivePartyAlerts(members, presence, dmUserId), [members, presence, dmUserId]);
  // Acknowledged alerts stay hidden until their underlying state changes —
  // the signature (title + detail) is the change detector.
  const [ackedAlerts, setAckedAlerts] = useState<Record<string, string>>({});
  const alertSignature = (alert: { title: string; detail?: string }) => `${alert.title}|${alert.detail ?? ""}`;
  const visibleAlerts = alerts.filter((alert) => ackedAlerts[alert.id] !== alertSignature(alert));
  const hasGhosts = players.some((member) => member.isGhost);
  const ready = players.filter((member) => member.isGhost || ["connected", "background"].includes(presence.find((item) => item.userId === member.userId)?.state ?? "disconnected")).length;

  return (
    <aside className={`dm-command-party${compact ? " is-compact" : ""}`} aria-label="Party command center">
      <header>
        <span>Party</span>
        <strong>{players.length} adventurer{players.length === 1 ? "" : "s"}</strong>
        {hasGhosts ? <em className="dm-rehearsal-mark">Rehearsal party{onClearRehearsal ? <button type="button" onClick={onClearRehearsal} disabled={rehearsalBusy} aria-label="Clear the rehearsal party"><X size={11} /></button> : null}</em> : null}
        <small>{concerns ? `${concerns} need attention` : "Party state is steady"}{concentrating ? ` · ${concentrating} concentrating` : ""}</small>
      </header>
      {visibleAlerts.length ? <section className="dm-party-alerts" aria-label="Party alerts"><h4><AlertTriangle size={13}/> Needs attention</h4>{visibleAlerts.slice(0, 4).map((alert) => <div key={alert.id} className="dm-alert-row"><button type="button" data-severity={alert.severity} onClick={() => { const member = players.find((item) => item.userId === alert.userId); if (member) onSelect(member); }}><strong>{alert.title}</strong>{alert.detail ? <small>{alert.detail}</small> : null}</button><button type="button" className="dm-alert-ack" aria-label={`Dismiss alert: ${alert.title}`} onClick={() => setAckedAlerts((current) => ({ ...current, [alert.id]: alertSignature(alert) }))}><X size={12} /></button></div>)}</section> : null}
      <div className="dm-command-party-list" role="listbox" aria-label="Party members">
        {players.map((member) => {
          const state = memberHpState(member);
          const percent = member.maxHp ? Math.max(0, Math.min(100, ((member.currentHp ?? 0) / member.maxHp) * 100)) : 0;
          const resources = deriveImportantResources(member).slice(0, 2);
          const selected = selectedUserId === member.userId;
          const current = currentTurnUserId === member.userId;
          const presenceState = member.isGhost ? "rehearsal" : presence.find((item) => item.userId === member.userId)?.state ?? "disconnected";
          const name = member.characterName ?? member.userName;
          return (
            <div key={member.userId} className={`dm-command-member is-${state}${selected ? " is-selected" : ""}${current ? " is-current" : ""}${member.isGhost ? " is-rehearsal" : ""}`}>
              <button type="button" role="option" aria-selected={selected} onClick={() => onSelect(member)}>
                <span className="dm-member-primary">
                  <CharacterPortrait member={member} />
                  <span className="dm-command-member-name">
                    <strong>{name}{member.isGhost ? <em className="dm-rehearsal-mark">rehearsal</em> : null}</strong>
                    <small>{member.characterClass ? `${member.characterClass} ${member.characterLevel ?? ""}` : "Character not loaded"} · {presenceState}</small>
                    <span className="dm-command-hp-copy">HP {member.currentHp ?? "—"} / {member.maxHp ?? "—"}{member.tempHp ? ` · +${member.tempHp} temp` : ""}</span>
                    <span className="dm-command-hp" role="progressbar" aria-label={`${name} hit points`} aria-valuemin={0} aria-valuemax={member.maxHp ?? 0} aria-valuenow={member.currentHp ?? 0}>
                      <i style={{ width: `${percent}%` }} /><b>{state === "unconscious" ? "Unconscious" : state}</b>
                    </span>
                    <span className="dm-vitals-strip" aria-label={`${name} vitals`}>
                      <span><small>AC</small><b>{member.ac ?? "—"}</b></span>
                      <span><small>PP</small><b>{member.passivePerception ?? "—"}</b></span>
                      <span><small>Speed</small><b>{member.speed ?? "—"}</b></span>
                    </span>
                  </span>
                </span>
                {!compact ? (
                  <>
                    {member.conditions.length || member.concentratingOn ? <span className="dm-command-tags">{member.conditions.slice(0, 3).map((condition) => <ConditionChip key={condition} label={condition} />)}{member.concentratingOn ? <ConditionChip label={`Concentrating · ${member.concentratingOn}`} concentration /> : null}</span> : null}
                    <SpellSlotTrack slots={member.spellSlots} compact />
                    {resources.length ? <span className="dm-command-resources">{resources.map((resource) => <ResourceChip key={resource.id} resource={resource} />)}</span> : null}
                    {member.currentHp === 0 && member.deathSaves ? <span className="dm-command-death"><HeartPulse size={12}/> Saves {member.deathSaves.successes}/3 · Fails {member.deathSaves.failures}/3</span> : null}
                  </>
                ) : null}
              </button>
              {/* Rendered after the summary button: it must stay :first-child
                  for the era selectors, or it falls back to the UA's dark
                  ButtonFace (the gray-slab bug). Absolute position makes DOM
                  order irrelevant for layout. */}
              {member.characterClass ? <img className="dm-class-sigil" src={`/class-icons/${member.characterClass}.svg`} alt="" aria-hidden="true" /> : null}
              <button type="button" className="dm-command-open-sheet" onClick={() => onOpenSheet(member)} aria-label={`Open ${name} full sheet`} disabled={!member.characterJson}><Eye size={14}/></button>
            </div>
          );
        })}
        {!players.length ? <div className="dm-command-empty">
          <p>No player characters are enrolled yet.</p>
          {onSeatRehearsal ? <>
            <button type="button" className="dm-btn dm-btn-primary" onClick={onSeatRehearsal} disabled={rehearsalBusy}>{rehearsalBusy ? "Seating the party…" : "Seat a rehearsal party"}</button>
            <small>Four ghost adventurers the server plays for you — rehearse rolls, rests, conditions, and loot before the real party arrives.</small>
          </> : null}
        </div> : null}
      </div>
      <footer className="dm-party-readiness"><span>{ready === players.length && players.length ? <Wifi size={13}/> : <WifiOff size={13}/>} Session readiness</span><strong>{ready} of {players.length} ready</strong></footer>
    </aside>
  );
});
