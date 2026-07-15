import type { ReactNode } from "react";

/* Decorative die glyphs for the sheet's roll controls. Always aria-hidden:
   the accessible name on the button already names the action. */

export function D20Icon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="12 2 20.7 7 20.7 17 12 22 3.3 17 3.3 7" />
      <polygon points="12 7.4 17.4 15.6 6.6 15.6" />
    </svg>
  );
}

export function DieIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * One recognizable, always-visible roll control (Carded Observatory §6).
 * Stateless presentation shell: it receives the final displayed modifier or
 * formula and the existing roll callback — never raw scores, never new math.
 */
export default function SheetRollButton({
  label,
  display,
  onRoll,
  disabled,
  compact,
  title,
  icon = "d20",
  className,
}: {
  /** Specific accessible name, e.g. "Roll Stealth, +4". */
  label: string;
  /** What players see: a formatted modifier, formula, or action word. */
  display: ReactNode;
  onRoll: () => void;
  disabled?: boolean;
  compact?: boolean;
  title?: string;
  icon?: "d20" | "die";
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`cs-roll-btn${compact ? " cs-roll-btn--compact" : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onRoll}
    >
      {icon === "die" ? <DieIcon /> : <D20Icon />}
      <span>{display}</span>
    </button>
  );
}
