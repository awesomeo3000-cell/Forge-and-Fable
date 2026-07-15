"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { BUILD_MODE_DESCRIPTORS } from "@/lib/ledgerCopy";

type BuildMode = "standard" | "quickbuilder" | "premade";

/* These plates are intentionally swappable: the commission screen can take
   new owner art without changing the build flow or its callbacks. */
const BUILD_MODES: Array<{ mode: BuildMode; label: string; plate: string; art: string }> = [
  { mode: "standard", label: "Standard", plate: "PLATE I", art: "/Start/start-standard.webp" },
  { mode: "quickbuilder", label: "Quickbuilder", plate: "PLATE II", art: "/Start/start-quick.webp" },
  { mode: "premade", label: "Premade", plate: "PLATE III", art: "/Start/start-premade-spliced.webp" },
];

export default memo(function CharacterStartPanel(props: {
  onSelectBuild: (mode: BuildMode) => void;
  onBack?: () => void;
  rosterEmpty?: boolean;
}) {
  const [selectedMode, setSelectedMode] = useState<BuildMode | null>(null);

  return (
    <div className="start-panel commission-screen dj-start">
      <div className="commission-head">
        <header className="commission-page-head">
          <span className="commission-eyebrow">
            {props.rosterEmpty ? "The roster is empty" : "The ledger opens"}
          </span>
          <h2>Commission a character</h2>
        </header>
        <div className="commission-actions">
          {props.onBack ? (
            <button type="button" className="commission-button" onClick={props.onBack}>
              Back
            </button>
          ) : null}
          <button
            type="button"
            className="commission-button commission-button-primary"
            disabled={!selectedMode}
            onClick={() => selectedMode && props.onSelectBuild(selectedMode)}
          >
            Open the commission
          </button>
        </div>
      </div>

      <div className="commission-strip">
        {BUILD_MODES.map((item) => {
          const chosen = selectedMode === item.mode;
          return (
            <button
              type="button"
              key={item.mode}
              className={`commission-panel commission-panel-${item.mode}${chosen ? " chosen" : ""}`}
              aria-pressed={chosen}
              onClick={() => setSelectedMode(item.mode)}
              onDoubleClick={() => props.onSelectBuild(item.mode)}
            >
              <span className="commission-plate" aria-hidden="true">
                <Image
                  src={item.art}
                  alt=""
                  fill
                  sizes="(max-width: 760px) 100vw, 33vw"
                  loading="lazy"
                  draggable={false}
                  onError={(event) => { event.currentTarget.style.display = "none"; }}
                />
              </span>
              <span className="commission-tag">{item.plate}</span>
              <span className="commission-caption">
                <span className="commission-caption-rule" aria-hidden="true" />
                <span className="commission-label">{item.label}</span>
                <span className="commission-desc">{BUILD_MODE_DESCRIPTORS[item.mode]}</span>
                {chosen ? <em className="commission-state">Chosen ✦</em> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
