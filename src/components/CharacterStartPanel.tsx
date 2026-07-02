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
    <div className="start-panel paper-surface">
      <div className="start-copy">
        <span>Empty Character Vault</span>
        <h2>Create a new character</h2>
        <p>Choose how you want to begin. You can name the character and pick rule sources on the next screen.</p>
      </div>
      <div className="build-mode-grid">
        {buildModes.map((item) => (
          <button
            type="button"
            className={`build-mode-card ${selectedMode === item.mode ? "active" : ""}`}
            aria-pressed={selectedMode === item.mode}
            key={item.mode}
            onClick={() => setSelectedMode(item.mode)}
          >
            {item.icon === "standard" ? <ShieldCheck size={28} /> : null}
            {item.icon === "quickbuilder" ? <CircleGauge size={28} /> : null}
            {item.icon === "premade" ? <Swords size={28} /> : null}
            <strong>{item.label}</strong>
            <span>{item.summary}</span>
          </button>
        ))}
      </div>
      <div className="start-actions">
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
