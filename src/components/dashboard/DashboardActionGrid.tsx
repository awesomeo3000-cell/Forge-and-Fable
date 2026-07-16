"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { DashboardAction, DashboardActionArt, DashboardActionId } from "@/lib/dashboardContext";
import { ACTION_ICON } from "./dashboardIcons";

const ART_SRC: Record<DashboardActionArt, string> = {
  character: "/dashboard/card-character.webp",
  campaign: "/dashboard/card-campaign.webp",
  join: "/dashboard/card-join.webp",
  import: "/dashboard/card-import.webp",
};

/**
 * Context-aware action grid (dashboard handoff §6): four cards, exactly one
 * primary. Two-step interaction: clicking a card body highlights it (the
 * selection toggle), and the card's CTA button commits the action. Kept as
 * two real buttons — a full-bleed selection button and the CTA — so the
 * pattern stays keyboard- and screen-reader-accessible (handoff §11/§13:
 * cards are never clickable only through a nested text link).
 */
export default function DashboardActionGrid(props: {
  heading: string;
  subhead: string;
  actions: DashboardAction[];
  onAction: (id: DashboardActionId) => void;
}) {
  const [selectedId, setSelectedId] = useState<DashboardActionId | null>(null);
  // One card is always highlighted: the user's pick, or the primary by default.
  // Falls back to the primary when the resolved actions change (e.g. new → dm).
  const effectiveSelected = props.actions.some((action) => action.id === selectedId)
    ? selectedId
    : props.actions[0]?.id ?? null;

  return (
    <section aria-labelledby="ao-hd-action-heading">
      <div className="ao-hd-section-head">
        <div>
          <h2 id="ao-hd-action-heading">{props.heading}</h2>
          <p>{props.subhead}</p>
        </div>
      </div>
      <div className="ao-hd-action-grid" role="group" aria-label={props.heading}>
        {props.actions.map((action, index) => {
          const Icon = ACTION_ICON[action.id];
          const selected = action.id === effectiveSelected;
          return (
            <div
              key={action.id}
              className={`ao-hd-action-card${action.primary ? " primary" : ""}${selected ? " selected" : ""}`}
            >
              <span className="ao-hd-action-art" aria-hidden="true">
                <Image
                  src={ART_SRC[action.art]}
                  alt=""
                  fill
                  sizes="(max-width: 760px) 100vw, 25vw"
                  loading={index === 0 ? "eager" : "lazy"}
                  draggable={false}
                />
              </span>
              {/* Selection layer: covers the card, highlights it, does not act. */}
              <button
                type="button"
                className="ao-hd-action-select"
                aria-pressed={selected}
                aria-label={`Highlight ${action.title}`}
                onClick={() => setSelectedId(action.id)}
              />
              <span className="ao-hd-action-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={1.6} />
              </span>
              <span className="ao-hd-action-copy">
                <strong>{action.title}</strong>
                <span className="ao-hd-action-desc">{action.description}</span>
                {/* CTA: the actual action, layered above the selection button. */}
                <button
                  type="button"
                  className="ao-hd-action-cta"
                  onClick={() => props.onAction(action.id)}
                >
                  {action.cta} <ArrowRight size={13} aria-hidden="true" />
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
