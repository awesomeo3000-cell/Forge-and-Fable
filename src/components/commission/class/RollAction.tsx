/**
 * Roll-generating control (Orrery Path §15): dice icon + verb + expression,
 * visually distinct from passive chips. Invokes whatever roll flow the
 * parent wires in — it owns no dice logic itself.
 */
export default function RollAction(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      className="ao-roll-action"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.disabled ? props.disabledReason : undefined}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 2 21 7.2v9.6L12 22 3 16.8V7.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M12 6.6 17.3 15H6.7ZM12 2v4.6M21 7.2 17.3 15M3 7.2 6.7 15M12 22l-1.8-7M12 22l1.8-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <span>{props.label}</span>
    </button>
  );
}
