"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Race } from "@/types/game";
import SpeciesIconPlaceholder from "@/components/icons/SpeciesIcon";
import { useFocusTrap } from "@/lib/useFocusTrap";

import { memo } from "react";

export default memo(function SpeciesLearnModal(props: {
  species: Race;
  selected: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
        queueMicrotask(() => triggerRef.current?.focus());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      queueMicrotask(() => triggerRef.current?.focus());
    };
  }, [props]);

  return createPortal(
    <div className="modal-scrim" role="presentation" onMouseDown={props.onClose}>
      <section
        ref={dialogRef}
        aria-labelledby="species-learn-title"
        aria-modal="true"
        className="class-modal species-modal paper-surface ledger-page"
        data-species={props.species.id}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="glass-icon modal-close" type="button" onClick={props.onClose} title="Close">
          <X size={18} />
        </button>

        <header className="ledger-modal-head">
          <span className="ledger-modal-seal" data-species={props.species.id} aria-hidden="true">
            <SpeciesIconPlaceholder speciesId={props.species.id} size={34} strokeWidth={1.6} />
          </span>
          <div className="ledger-modal-title">
            <span className="ledger-eyebrow">
              {props.species.sourceLabel ? `${props.species.sourceLabel} / ` : ""}
              {props.species.sourceBook}
            </span>
            <h3 id="species-learn-title">{props.species.name}</h3>
            <p>{props.species.summary}</p>
          </div>
        </header>

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
              <span className="ledger-disclosure" aria-hidden="true">›</span>
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
          <button className="ledger-button" type="button" onClick={props.onClose}>
            Back
          </button>
          <button className="ledger-button ledger-button-primary" type="button" onClick={props.onSelect}>
            {props.selected ? "Keep species" : "Choose species"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
})
