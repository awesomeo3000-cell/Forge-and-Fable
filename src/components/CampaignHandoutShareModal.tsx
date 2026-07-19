"use client";

import { useState } from "react";
import { Share2, X } from "lucide-react";
import { dmToolsApi } from "@/lib/client/dmToolsApi";
import type { CampaignMemberSummary } from "@/types/campaign";
import type { CampaignHandout } from "@/types/dmTools";

export default function CampaignHandoutShareModal(props: {
  campaignId: string;
  handout: CampaignHandout;
  members: CampaignMemberSummary[];
  dmUserId: string;
  onClose: () => void;
  onShared: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const players = props.members.filter((member) => member.userId !== props.dmUserId && !member.isGhost);
  const share = async (recipientUserId: string | null) => {
    setBusy(true); setError("");
    try {
      await dmToolsApi.shareHandout(props.campaignId, props.handout.id, recipientUserId);
      props.onShared();
      props.onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not share the handout.");
    } finally {
      setBusy(false);
    }
  };
  return <div className="modal-scrim" role="presentation" onMouseDown={props.onClose}>
    <section className="campaign-handout-share" role="dialog" aria-modal="true" aria-labelledby="campaign-handout-share-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="ledger-eyebrow">Handout sharing</span><h2 id="campaign-handout-share-title">{props.handout.title}</h2></div><button type="button" className="modal-close glass-icon" onClick={props.onClose} aria-label="Close sharing dialog"><X size={18} /></button></header>
      <p className="campaign-handout-share-status">{props.handout.shared ? "This handout is already shared. Choose a new audience to share it again." : "Private — only you can see this handout until you share it."}</p>
      <div className="campaign-handout-share-options"><button type="button" className="dm-btn dm-btn-primary" disabled={busy} onClick={() => void share(null)}><Share2 size={15} /> Share with everyone</button><span>or choose a registered player:</span>{players.length ? <div className="campaign-handout-player-options">{players.map((member) => <button key={member.userId} type="button" className="dm-btn" disabled={busy} onClick={() => void share(member.userId)}>{member.characterName ?? member.userName}</button>)}</div> : <p>No other registered players are currently in this campaign.</p>}</div>
      {error ? <p className="campaign-handout-upload-error">{error}</p> : null}
      <footer><button type="button" className="dm-btn" onClick={props.onClose} disabled={busy}>Cancel</button></footer>
    </section>
  </div>;
}
