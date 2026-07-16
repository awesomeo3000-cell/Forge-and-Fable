import { Check, Clock3 } from "lucide-react";
import CharacterPortrait from "@/components/portraits/CharacterPortrait";
import type { PartyMemberView } from "@/lib/campaignWorkspaceModel";

/**
 * Party card grid (campaign workspace handoff §10). Uses the player's selected
 * portrait, shows character identity, HP where present and a text + colour
 * ready state. Player data boundaries are respected upstream (ghosts and
 * DM-only fields never reach PartyMemberView).
 */
export default function CampaignPartyGrid(props: {
  members: PartyMemberView[];
  viewerUserId?: string;
  onOpenMember?: (member: PartyMemberView) => void;
}) {
  return (
    <ul className="ao-cw-party-grid">
      {props.members.map((member) => {
        const isViewer = member.userId === props.viewerUserId;
        const hpPct = member.currentHp !== null && member.maxHp ? Math.max(0, Math.min(100, (member.currentHp / member.maxHp) * 100)) : null;
        const canOpen = Boolean(member.characterId && props.onOpenMember);
        return (
          <li key={member.userId}>
            <div className={`ao-cw-party-card${isViewer ? " is-viewer" : ""}`}>
              <span className="ao-cw-party-art" aria-hidden={member.characterName ? undefined : "true"}>
                <CharacterPortrait
                  portraitId={member.portraitId}
                  characterName={member.characterName ?? member.userName}
                  size={112}
                  shape="rounded"
                  decorative={!member.characterName}
                  className="ao-cw-party-portrait"
                />
                <span className={`ao-cw-ready${member.ready ? " is-ready" : ""}`}>
                  {member.ready ? <Check size={11} aria-hidden="true" /> : <Clock3 size={11} aria-hidden="true" />}
                  {member.ready ? "Ready" : "Waiting"}
                </span>
              </span>
              <div className="ao-cw-party-copy">
                <strong>{member.characterName ?? member.userName}</strong>
                <small>
                  {member.characterName ? member.userName : "No character assigned"}
                  {isViewer ? " · You" : ""}
                </small>
                {member.characterClass ? (
                  <span className="ao-cw-party-class">Level {member.characterLevel} {member.characterClass}</span>
                ) : null}
                {hpPct !== null ? (
                  <span className="ao-cw-hp" aria-label={`Hit points ${member.currentHp} of ${member.maxHp}`}>
                    <span className="ao-cw-hp-bar"><span style={{ width: `${hpPct}%` }} /></span>
                    <small>{member.currentHp} / {member.maxHp} HP</small>
                  </span>
                ) : null}
                {member.conditions.length > 0 ? (
                  <span className="ao-cw-conditions">{member.conditions.slice(0, 3).join(", ")}</span>
                ) : null}
                {canOpen ? (
                  <button type="button" className="ao-cw-link" onClick={() => props.onOpenMember!(member)}>
                    {isViewer ? "Open my character" : "View character"}
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
