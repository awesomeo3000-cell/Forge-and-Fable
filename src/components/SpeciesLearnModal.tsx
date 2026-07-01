"use client";

import { ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Race } from "@/types/game";
import SpeciesIconPlaceholder from "@/components/icons/SpeciesIcon";

import { memo } from "react";

export default memo(function SpeciesLearnModal(props: {
  species: Race;
  selected: boolean;
  onClose: () => void;
  onSelect: () => void;
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
        aria-labelledby="species-learn-title"
        aria-modal="true"
        className="class-modal species-modal"
        data-species={props.species.id}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="glass-icon modal-close" type="button" onClick={props.onClose} title="Close">
          <X size={18} />
        </button>

        <div className="class-modal-hero">
          <div className="class-icon-stage compact" data-species={props.species.id}>
            <SpeciesIconPlaceholder speciesId={props.species.id} size={54} strokeWidth={1.45} />
          </div>
          <div>
            <span>
              {props.species.sourceLabel ? `${props.species.sourceLabel} / ` : ""}
              {props.species.sourceBook}
            </span>
            <h3 id="species-learn-title">{props.species.name}</h3>
            <p>{props.species.summary}</p>
          </div>
        </div>

        <div className="class-detail-stack">
          <div className="species-facts">
            <span>
              Creature Type
              <strong>{props.species.creatureType}</strong>
            </span>
            <span>
              Size
              <strong>{props.species.size}</strong>
            </span>
            <span>
              Speed
              <strong>{props.species.speed}</strong>
            </span>
          </div>

          <details className="class-detail-card" open>
            <summary>
              <span>Unique Features & Traits</span>
              <ChevronRight size={18} />
            </summary>
            <div className="level-list species-trait-list">
              {props.species.traits.map((trait) => (
                <div className="level-row species-trait-row" key={trait.name}>
                  <strong>{trait.name}</strong>
                  <span className="feature-unlock">
                    <small>{trait.description}</small>
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div className="class-modal-actions">
          <button className="glass-button" type="button" onClick={props.onClose}>
            Back
          </button>
          <button className="gold-button" type="button" onClick={props.onSelect}>
            {props.selected ? "Keep species" : "Choose species"}
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
})
