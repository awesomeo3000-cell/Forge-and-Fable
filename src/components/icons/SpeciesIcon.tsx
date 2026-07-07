"use client";

import type { CSSProperties } from "react";

const RACE_ICON_PATHS: Record<string, string> = {
  "aarakocra": "/race-icons/aarakocra.svg",
  "aarakocra-legacy": "/race-icons/aarakocra.svg",
  "aasimar": "/race-icons/aasimar.svg",
  "air-genasi": "/race-icons/air-genasi.svg",
  "air-genasi-legacy": "/race-icons/air-genasi.svg",
  "dragonborn": "/race-icons/dragonborn.svg",
  "dragonborn-legacy": "/race-icons/dragonborn.svg",
  "drow": "/race-icons/drow.svg",
  "dark-elf": "/race-icons/drow.svg",
  "deep-gnome": "/race-icons/deep-gnome.svg",
  "deep-gnome-legacy": "/race-icons/deep-gnome.svg",
  "dwarf": "/race-icons/dwarf.svg",
  "dwarf-legacy": "/race-icons/dwarf.svg",
  "earth-genasi": "/race-icons/earth-genasi.svg",
  "earth-genasi-legacy": "/race-icons/earth-genasi.svg",
  "elf": "/race-icons/elf.svg",
  "elf-legacy": "/race-icons/elf.svg",
  "firbolg": "/race-icons/firbolg.svg",
  "fire-genasi": "/race-icons/fire-genasi.svg",
  "fire-genasi-legacy": "/race-icons/fire-genasi.svg",
  "forest-gnome": "/race-icons/forest-gnome.svg",
  "forest-gnome-legacy": "/race-icons/forest-gnome.svg",
  "genasi": "/race-icons/genasi.svg",
  "genasi-legacy": "/race-icons/genasi.svg",
  "gnome": "/race-icons/gnome.svg",
  "goliath": "/race-icons/goliath.svg",
  "goliath-legacy": "/race-icons/goliath.svg",
  "half-elf": "/race-icons/half-elf.svg",
  "half-elf-legacy": "/race-icons/half-elf.svg",
  "half-orc": "/race-icons/half-orc.svg",
  "half-orc-legacy": "/race-icons/half-orc.svg",
  "halfling": "/race-icons/halfling.svg",
  "halfling-legacy": "/race-icons/halfling.svg",
  "high-elf": "/race-icons/high-elf.svg",
  "human": "/race-icons/human.svg",
  "human-legacy": "/race-icons/human.svg",
  "orc": "/race-icons/orc.svg",
  "rock-gnome": "/race-icons/rock-gnome.svg",
  "rock-gnome-legacy": "/race-icons/rock-gnome.svg",
  "tiefling": "/race-icons/tiefling.svg",
  "tiefling-legacy": "/race-icons/tiefling.svg",
  "triton": "/race-icons/triton.svg",
  "variant-aasimar": "/race-icons/aasimar.svg",
  "water-genasi": "/race-icons/water-genasi.svg",
  "water-genasi-legacy": "/race-icons/water-genasi.svg",
  "yuan-ti": "/race-icons/yuan-ti.svg",
  "yuan-ti-pureblood": "/race-icons/yuan-ti.svg",
};

type IconMaskStyle = CSSProperties & {
  "--species-icon-url": string;
};

function SpeciesIconPlaceholder(props: {
  speciesId: string;
  size: number;
  strokeWidth?: number;
}) {
  const id = props.speciesId.toLowerCase();
  const iconPath = RACE_ICON_PATHS[id];

  if (iconPath) {
    const style: IconMaskStyle = {
      "--species-icon-url": `url("${iconPath}")`,
      height: props.size,
      width: props.size,
    };

    return (
      <span
        aria-hidden="true"
        className="species-symbol species-symbol-mask"
        style={style}
      />
    );
  }

  const strokeWidth = props.strokeWidth ?? 2;
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth,
  };

  return (
    <svg
      aria-hidden="true"
      className="species-symbol"
      focusable="false"
      height={props.size}
      viewBox="0 0 64 64"
      width={props.size}
    >
      {id.includes("dragonborn") ? (
        <>
          <path {...common} d="M18 48V28l14-16 14 16v20" />
          <path {...common} d="M24 24 16 14m24 10 8-10" />
          <path {...common} d="M24 48c4-8 12-8 16 0" />
          <path {...common} d="M32 28c6 7 6 13 0 18-6-5-6-11 0-18Z" />
        </>
      ) : null}
      {id.includes("dwarf") ? (
        <>
          <path {...common} d="M18 48h28" />
          <path {...common} d="M24 48V28h16v20" />
          <path {...common} d="M22 28 32 14l10 14" />
          <path {...common} d="M18 36h28" />
        </>
      ) : null}
      {id.includes("elf") ? (
        <>
          <path {...common} d="M32 10c12 10 15 24 9 42-13-4-20-17-9-42Z" />
          <path {...common} d="M32 10c-12 10-15 24-9 42 13-4 20-17 9-42Z" />
          <path {...common} d="M32 22v28" />
        </>
      ) : null}
      {id.includes("gnome") ? (
        <>
          <path {...common} d="M18 42 32 14l14 28Z" />
          <path {...common} d="M24 42v10h16V42" />
          <path {...common} d="M22 48h20" />
          <circle {...common} cx="32" cy="31" r="5" />
        </>
      ) : null}
      {id.includes("goliath") ? (
        <>
          <path {...common} d="M12 50 26 22l8 16 6-10 12 22Z" />
          <path {...common} d="M26 22 32 36l8-8" />
          <path {...common} d="M19 50h26" />
        </>
      ) : null}
      {id.includes("halfling") ? (
        <>
          <path {...common} d="M32 48c-10-8-16-15-16-24 0-7 8-10 16-2 8-8 16-5 16 2 0 9-6 16-16 24Z" />
          <path {...common} d="M32 48v8" />
          <path {...common} d="M24 56h16" />
        </>
      ) : null}
      {id.includes("human") ? (
        <>
          <circle {...common} cx="32" cy="18" r="8" />
          <path {...common} d="M18 54c2-13 8-20 14-20s12 7 14 20" />
          <path {...common} d="M18 32h28" />
        </>
      ) : null}
      {id.includes("orc") ? (
        <>
          <path {...common} d="M18 34c2-13 10-20 14-20s12 7 14 20c0 12-7 20-14 20s-14-8-14-20Z" />
          <path {...common} d="M24 38c2 6 14 6 16 0" />
          <path {...common} d="M25 39v9m14-9v9" />
          <path {...common} d="M24 28h.1M40 28h.1" />
        </>
      ) : null}
      {id.includes("tiefling") ? (
        <>
          <path {...common} d="M22 18c-7 5-8 12-2 19" />
          <path {...common} d="M42 18c7 5 8 12 2 19" />
          <path {...common} d="M22 28c0-10 20-10 20 0v14c0 8-20 8-20 0Z" />
          <path {...common} d="M28 48c2 4 6 4 8 0" />
        </>
      ) : null}
      {id.includes("aasimar") ? (
        <>
          <path {...common} d="M32 10 38 26l16 6-16 6-6 16-6-16-16-6 16-6Z" />
          <path {...common} d="M18 50c7-8 21-8 28 0" />
        </>
      ) : null}
      {id.includes("aarakocra") ? (
        <>
          <path {...common} d="M8 42c12-18 24-18 24-2 0-16 12-16 24 2" />
          <path {...common} d="M24 32 32 12l8 20" />
          <path {...common} d="M26 48h12" />
        </>
      ) : null}
      {id.includes("genasi") ? (
        <>
          <path {...common} d="M32 8c10 10 14 18 14 28a14 14 0 0 1-28 0c0-10 4-18 14-28Z" />
          <path {...common} d="M22 38c6-5 14-5 20 0" />
          <path {...common} d="M24 48c6 4 10 4 16 0" />
        </>
      ) : null}
      {!id ? (
        <>
          <path {...common} d="M32 12 44 20v24L32 52 20 44V20z" />
          <path {...common} d="M20 20 32 28l12-8" />
          <path {...common} d="M32 28v24" />
        </>
      ) : null}
    </svg>
  );
}

export default SpeciesIconPlaceholder;
