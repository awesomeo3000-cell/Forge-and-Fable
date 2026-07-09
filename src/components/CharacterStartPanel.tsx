"use client";

import { memo, useState } from "react";
import { BUILD_MODE_DESCRIPTORS } from "@/lib/ledgerCopy";

type BuildMode = "standard" | "quickbuilder" | "premade";

const BUILD_MODES: Array<{ mode: BuildMode; label: string }> = [
  { mode: "standard", label: "Standard" },
  { mode: "quickbuilder", label: "Quickbuilder" },
  { mode: "premade", label: "Premade" },
];

export default memo(function CharacterStartPanel(props: {
  onSelectBuild: (mode: BuildMode) => void;
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
      <div className="ledger-option-list">
        {BUILD_MODES.map((item) => {
          const chosen = selectedMode === item.mode;
          return (
            <button
              type="button"
              key={item.mode}
              className={`ledger-option ${chosen ? "active" : ""}`}
              aria-pressed={chosen}
              onClick={() => setSelectedMode(item.mode)}
            >
              <span className="ledger-option-name">{item.label}</span>
              <span className="ledger-option-desc">{BUILD_MODE_DESCRIPTORS[item.mode]}</span>
              {chosen ? <em className="ledger-option-state">Chosen ✦</em> : null}
            </button>
          );
        })}
      </div>
      <div className="start-actions dj-footer ledger-page-footer">
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
