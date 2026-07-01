"use client";

import { ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { HeroClass } from "@/types/game";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";

import { memo } from "react";

export default memo(function ClassLearnModal(props: {
  heroClass: HeroClass;
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
        aria-labelledby="class-learn-title"
        aria-modal="true"
        className="class-modal"
        data-class={props.heroClass.id}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="glass-icon modal-close" type="button" onClick={props.onClose} title="Close">
          <X size={18} />
        </button>

        <div className="class-modal-hero">
          <div className="class-icon-stage compact" data-class={props.heroClass.id}>
            <ClassIconPlaceholder classId={props.heroClass.id} size={54} strokeWidth={1.45} />
          </div>
          <div>
            <span>{props.heroClass.sourceBook}</span>
            <h3 id="class-learn-title">{props.heroClass.name}</h3>
            <p>{props.heroClass.summary}</p>
          </div>
        </div>

        <div className="class-detail-stack">
          <details className="class-detail-card">
            <summary>
              <span>Core Traits</span>
              <ChevronRight size={18} />
            </summary>
            <div className="trait-grid">
              {props.heroClass.coreTraits.map((trait) => (
                <span key={trait}>{trait}</span>
              ))}
            </div>
          </details>

          <details className="class-detail-card" open>
            <summary>
              <span>Level Progression</span>
              <ChevronRight size={18} />
            </summary>
            <div className="level-list">
              {props.heroClass.levelProgression.map((entry) => (
                <div className="level-row" key={entry.level}>
                  <strong>Level {entry.level}</strong>
                  <div className="feature-stack">
                    {entry.features.map((feature) => (
                      <span className="feature-unlock" key={feature.name}>
                        <b>{feature.name}</b>
                        <small>{feature.description}</small>
                      </span>
                    ))}
                  </div>
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
            {props.selected ? "Keep class" : "Choose class"}
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
})
