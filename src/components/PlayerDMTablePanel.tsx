"use client";

import { X } from "lucide-react";
import type { CampaignEvent, CampaignSyncPayload } from "@/types/campaign";

export default function PlayerDMTablePanel(props: { campaign: CampaignSyncPayload; events: CampaignEvent[]; onClose: () => void }) {
  const { campaign } = props;
  const view = campaign.campaign;
  return (
    <div className="modal-scrim" role="presentation">
      <section className="dm-table-panel ledger-page" role="dialog" aria-modal="true" aria-label="Shared table view">
        <header className="dm-table-head"><div><span className="ledger-eyebrow">Shared table</span><h2>{view.name}</h2></div><button type="button" className="dm-table-close" onClick={props.onClose} aria-label="Close shared table"><X size={18} /></button></header>
        <div className="dm-table-body">
          {view.playerDmViewInitiative ? <section className="dm-table-section"><h3>Initiative</h3><ol>{campaign.initiative.data.combatants.map((combatant) => <li key={combatant.id}><strong>{combatant.name}</strong><span>{combatant.initiative}</span>{combatant.healthLabel ? <small>{combatant.healthLabel}</small> : null}</li>)}</ol></section> : null}
          {view.playerDmViewParty ? <section className="dm-table-section"><h3>Party</h3><div className="dm-table-party-grid">{campaign.members.map((member) => <article key={member.userId}><strong>{member.characterName ?? member.userName}</strong><span>{member.characterClass ?? "Adventurer"}{member.characterLevel ? ` · level ${member.characterLevel}` : ""}</span></article>)}</div></section> : null}
          {view.playerDmViewRolls ? <section className="dm-table-section"><h3>Public rolls</h3><ul>{campaign.rolls.slice(-20).reverse().map((roll) => <li key={roll.id}><strong>{roll.character_name}</strong> {roll.label}: <b>{roll.total}</b></li>)}</ul></section> : null}
          {!view.playerDmViewInitiative && !view.playerDmViewParty && !view.playerDmViewRolls ? <p className="dm-table-empty">The DM has not shared any table panels yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
