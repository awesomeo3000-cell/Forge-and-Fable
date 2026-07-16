import type { ReactNode } from "react";

export type DecisionState = "neutral" | "incomplete" | "complete";

/**
 * One required-decision group (Orrery Path §14): title, completion status,
 * short instruction, and the controls themselves. State drives the accent —
 * amber only while a required choice is open, never red for "not yet".
 */
export default function ClassDecisionCard(props: {
  title: string;
  state: DecisionState;
  status?: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ao-class-decision" data-state={props.state}>
      <div className="ao-class-decision-head">
        <strong>{props.title}</strong>
        {props.status ? <span className="ao-class-decision-status">{props.status}</span> : null}
      </div>
      {props.hint ? <p className="ao-class-decision-hint">{props.hint}</p> : null}
      {props.children}
    </div>
  );
}
