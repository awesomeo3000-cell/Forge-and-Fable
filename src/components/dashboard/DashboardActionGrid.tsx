"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { DashboardAction, DashboardActionArt, DashboardActionId } from "@/lib/dashboardContext";
import { DASHBOARD_ARTWORK } from "@/data/dashboardArtwork";
import { ACTION_ICON } from "./dashboardIcons";

/** Fixed registry art for the non-dynamic families (final-polish handoff §4). */
const STATIC_ART: Record<Exclude<DashboardActionArt, "campaign" | "character">, string> = {
  prepare: DASHBOARD_ARTWORK.prepareSession,
  create: DASHBOARD_ARTWORK.createCharacter,
  table: DASHBOARD_ARTWORK.campaignFallback,
  join: DASHBOARD_ARTWORK.joinCard,
  import: DASHBOARD_ARTWORK.importCard,
};

/**
 * Dynamic card art (campaign appearance / character portrait): a plain <img>
 * so an arbitrary stored URL that fails to load swaps to the registry
 * fallback instead of a broken-image icon (handoff §17). Keyed by src by the
 * caller so the failed state resets when the source changes.
 */
function DynamicCardArt({ src, fallback, eager }: { src: string; fallback: string; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? fallback : src}
      alt=""
      loading={eager ? "eager" : "lazy"}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

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
  /** Resolved dynamic sources for the campaign/character art families. */
  dynamicArt?: { campaign?: string; character?: string };
  /** Subject names for accessible CTA labels, e.g. "Open Active Campaign: The Shattered Vale". */
  subjectNames?: Partial<Record<DashboardActionId, string>>;
  onAction: (id: DashboardActionId) => void;
}) {
  const [selectedId, setSelectedId] = useState<DashboardActionId | null>(null);
  // One card is always highlighted: the user's pick, or the primary by default.
  // Falls back to the primary when the resolved actions change (e.g. new → dm).
  const effectiveSelected = props.actions.some((action) => action.id === selectedId)
    ? selectedId
    : props.actions[0]?.id ?? null;

  const artSrc = (art: DashboardActionArt): string => {
    if (art === "campaign") return props.dynamicArt?.campaign ?? DASHBOARD_ARTWORK.campaignFallback;
    if (art === "character") return props.dynamicArt?.character ?? DASHBOARD_ARTWORK.characterFallback;
    return STATIC_ART[art];
  };

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
          const dynamic = action.art === "campaign" || action.art === "character";
          const src = artSrc(action.art);
          const subject = props.subjectNames?.[action.id];
          return (
            <div
              key={action.id}
              data-art={action.art}
              className={`ao-hd-action-card${action.primary ? " primary" : ""}${selected ? " selected" : ""}`}
            >
              <span className="ao-hd-action-art" aria-hidden="true">
                {dynamic ? (
                  <DynamicCardArt
                    key={src}
                    src={src}
                    fallback={action.art === "campaign" ? DASHBOARD_ARTWORK.campaignFallback : DASHBOARD_ARTWORK.characterFallback}
                    eager={index === 0}
                  />
                ) : (
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(max-width: 760px) 100vw, 25vw"
                    loading={index === 0 ? "eager" : "lazy"}
                    draggable={false}
                  />
                )}
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
                  aria-label={subject ? `${action.title}: ${subject}` : undefined}
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
