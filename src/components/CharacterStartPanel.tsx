"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { BUILD_MODE_DESCRIPTORS } from "@/lib/ledgerCopy";

type BuildMode = "standard" | "quickbuilder" | "premade";

/* Art lives in public/Start/ — swap the files to change the cards, no code
   edits needed. Every image gets the same ink-wash filter (CSS) so mixed
   sources read as plates from one book. */
const BUILD_MODES: Array<{ mode: BuildMode; label: string; art: string[] }> = [
  { mode: "standard", label: "Standard", art: ["/Start/start-standard.jpg"] },
  { mode: "quickbuilder", label: "Quickbuilder", art: ["/Start/start-quick.jpg"] },
  {
    mode: "premade",
    label: "Premade",
    art: [1, 2, 3, 4].map((n) => `/Start/start-premade-${n}.jpg`),
  },
];

export default memo(function CharacterStartPanel(props: {
  onSelectBuild: (mode: BuildMode) => void;
  onBack?: () => void;
  rosterEmpty?: boolean;
}) {
  const [selectedMode, setSelectedMode] = useState<BuildMode | null>(null);

  return (
    <div className="start-panel dj-start ledger-page">
      <header className="ledger-page-header">
        <span className="ledger-eyebrow">
          {props.rosterEmpty ? "The roster is empty" : "The ledger opens"}
        </span>
        <h2>Commission a character</h2>
      </header>
      <div className="threshold-grid">
        {BUILD_MODES.map((item) => {
          const chosen = selectedMode === item.mode;
          return (
            <button
              type="button"
              key={item.mode}
              className={`threshold-card${chosen ? " active" : ""}`}
              aria-pressed={chosen}
              onClick={() => setSelectedMode(item.mode)}
              onDoubleClick={() => props.onSelectBuild(item.mode)}
            >
              <span className={`threshold-art${item.art.length > 1 ? " threshold-quad" : ""}`} aria-hidden="true">
                {item.art.map((src) => (
                  <Image
                    key={src}
                    src={src}
                    alt=""
                    width={600}
                    height={900}
                    sizes="(max-width: 760px) 100vw, 33vw"
                    loading="lazy"
                    draggable={false}
                    // Missing file → hide the img; the parchment fallback
                    // (tint + ghost ornament) underneath stays presentable.
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ))}
              </span>
              <span className="threshold-scrim" aria-hidden="true" />
              <span className="threshold-caption">
                <span className="threshold-label">{item.label}</span>
                <span className="threshold-desc">{BUILD_MODE_DESCRIPTORS[item.mode]}</span>
                {chosen ? <em className="threshold-state">Chosen ✦</em> : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="start-actions dj-footer ledger-page-footer">
        {props.onBack ? (
          <button type="button" className="ledger-button" onClick={props.onBack}>
            Back
          </button>
        ) : null}
        <button
          type="button"
          className="ledger-button"
          disabled={!selectedMode}
          onClick={() => selectedMode && props.onSelectBuild(selectedMode)}
        >
          Open the commission
        </button>
      </div>
    </div>
  );
});
