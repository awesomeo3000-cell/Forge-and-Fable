"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Race } from "@/types/game";
import SpeciesIconPlaceholder from "@/components/icons/SpeciesIcon";

import { memo } from "react";

function bonusSummary(race: Race) {
  return Object.entries(race.bonuses)
    .map(([ability, value]) => `+${value} ${ability.slice(0, 3).toUpperCase()}`)
    .join(" / ");
}

export default memo(function SpeciesFamilyModal(props: {
  familyName: string;
  familySummary: string;
  members: Race[];
  selectedId?: string | null;
  onClose: () => void;
  onPick: (raceId: string) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  return createPortal(
    <div className="modal-scrim" role="presentation" onMouseDown={props.onClose}>
      <section
        aria-labelledby="species-family-title"
        aria-modal="true"
        className="class-modal species-modal species-family-modal paper-surface ledger-page"
        data-species={props.members[0]?.id}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="glass-icon modal-close" type="button" onClick={props.onClose} title="Close">
          <X size={18} />
        </button>

        <div className="class-modal-hero">
          <div className="class-icon-stage compact" data-species={props.members[0]?.id}>
            <SpeciesIconPlaceholder speciesId={props.members[0]?.id ?? ""} size={54} strokeWidth={1.45} />
          </div>
          <div>
            <span>{props.members.length} subspecies</span>
            <h3 id="species-family-title">{props.familyName}</h3>
            <p>{props.familySummary}</p>
          </div>
        </div>

        <div className="class-detail-stack">
          <div className="species-family-list">
            {props.members.map((member) => (
              <details className="class-detail-card species-family-row" key={member.id}>
                <summary>
                  <span className="species-family-row-icon" data-species={member.id}>
                    <SpeciesIconPlaceholder speciesId={member.id} size={22} strokeWidth={1.5} />
                  </span>
                  <span className="species-family-row-name">
                    {member.name}
                    {member.id === props.selectedId ? <em>sealed ✦</em> : null}
                  </span>
                  <small>{bonusSummary(member)}</small>
                  <span className="ledger-disclosure" aria-hidden="true">›</span>
                </summary>
                <div className="level-list species-trait-list">
                  {member.traits.map((trait) => (
                    <div className="level-row species-trait-row" key={trait.name}>
                      <strong>{trait.name}</strong>
                      <span className="feature-unlock">
                        <small>{trait.description}</small>
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="ledger-button ledger-button-primary species-family-pick"
                  onClick={() => props.onPick(member.id)}
                >
                  {member.id === props.selectedId ? "Keep this subspecies" : "Choose this subspecies"}
                </button>
              </details>
            ))}
          </div>
        </div>

        <div className="class-modal-actions">
          <button className="ledger-button" type="button" onClick={props.onClose}>
            Back
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
})
