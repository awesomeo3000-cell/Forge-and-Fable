"use client";

import { ChevronRight, CircleGauge, ShieldCheck, Swords } from "lucide-react";
import { memo, useState } from "react";

type BuildMode = "standard" | "quickbuilder" | "premade";

export default memo(function CharacterStartPanel(props: {
  onSelectBuild: (mode: BuildMode) => void;
}) {
  const [selectedMode, setSelectedMode] = useState<BuildMode | null>(null);
  const buildModes: Array<{
    mode: BuildMode;
    icon: "standard" | "quickbuilder" | "premade";
    label: string;
    summary: string;
  }> = [
    {
      mode: "standard",
      icon: "standard",
      label: "Standard",
      summary: "Build step by step with full control over identity, sources, class, and attributes.",
    },
    {
      mode: "quickbuilder",
      icon: "quickbuilder",
      label: "Quickbuilder",
      summary: "Start from guided choices now, with faster recommendations planned next.",
    },
    {
      mode: "premade",
      icon: "premade",
      label: "Premade",
      summary: "Reserve a slot for future archetypes like tank, healer, face, and spellcaster.",
    },
  ];

  return (
    <div className="start-panel paper-surface dj-start">
      <div className="dj-document-header">
        <span className="dj-eyebrow">Empty character vault</span>
        <h2>Create a new character</h2>
        <p>Choose a record style. Name and sources come next.</p>
      </div>
      <div className="dj-card-grid dj-mode-grid">
        {buildModes.map((item) => (
          <button
            type="button"
            className={`dj-card dj-mode-card ${selectedMode === item.mode ? "active" : ""}`}
            aria-pressed={selectedMode === item.mode}
            key={item.mode}
            onClick={() => setSelectedMode(item.mode)}
          >
            <div className="dj-card-tab" />
            <span className="dj-mode-icon">
              {item.icon === "standard" ? <ShieldCheck size={22} /> : null}
              {item.icon === "quickbuilder" ? <CircleGauge size={22} /> : null}
              {item.icon === "premade" ? <Swords size={22} /> : null}
            </span>
            <strong>{item.label}</strong>
            <small>{item.summary}</small>
            {selectedMode === item.mode ? <em>chosen</em> : null}
          </button>
        ))}
      </div>
      <div className="start-actions dj-footer">
        <button
          type="button"
          className="gold-button"
          disabled={!selectedMode}
          onClick={() => selectedMode && props.onSelectBuild(selectedMode)}
        >
          Continue
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
})
