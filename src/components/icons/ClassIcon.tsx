"use client";

import type { CSSProperties } from "react";

const CLASS_ICON_PATHS: Record<string, string> = {
  artificer: "/class-icons/artificer.svg",
  barbarian: "/class-icons/barbarian.svg",
  bard: "/class-icons/bard.svg",
  cleric: "/class-icons/cleric.svg",
  druid: "/class-icons/druid.svg",
  fighter: "/class-icons/fighter.svg",
  monk: "/class-icons/monk.svg",
  paladin: "/class-icons/paladin.svg",
  ranger: "/class-icons/ranger.svg",
  rogue: "/class-icons/rogue.svg",
  sorcerer: "/class-icons/sorcerer.svg",
  warlock: "/class-icons/warlock.svg",
  wizard: "/class-icons/wizard.svg",
};

type IconMaskStyle = CSSProperties & {
  "--class-icon-url": string;
};

function ClassIconPlaceholder(props: {
  classId: string;
  size: number;
  strokeWidth?: number;
}) {
  const iconPath = CLASS_ICON_PATHS[props.classId];

  if (iconPath) {
    const style: IconMaskStyle = {
      "--class-icon-url": `url("${iconPath}")`,
      height: props.size,
      width: props.size,
    };

    return (
      <span
        aria-hidden="true"
        className="class-symbol class-symbol-mask"
        style={style}
      />
    );
  }

  const strokeWidth = Math.max(3.15, (props.strokeWidth ?? 1.5) * 2.25);

  return (
    <svg
      aria-hidden="true"
      className="class-symbol"
      focusable="false"
      height={props.size}
      viewBox="0 0 64 64"
      width={props.size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      <path d="M32 11 38 26l15 6-15 6-6 15-6-15-15-6 15-6z" />
      <circle cx="32" cy="32" r="23" />
    </svg>
  );
}

export default ClassIconPlaceholder;
