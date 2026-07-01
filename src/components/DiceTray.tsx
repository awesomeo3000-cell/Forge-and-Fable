"use client";

import { Dices } from "lucide-react";
import { signed } from "@/lib/utils";

type RollEntry = {
  id: string;
  label: string;
  total: number;
  rolls: number[];
  modifier: number;
  createdAt: string;
};

export default function DiceTray(props: {
  rolls: RollEntry[];
  onRoll: (label: string, sides: number, count?: number, modifier?: number) => void;
}) {
  const dice = [20, 12, 10, 100, 8, 6, 4];

  return (
    <aside className="dice-panel">
      <div className="dice-heading">
        <span>Dice Tray</span>
        <Dices size={22} />
      </div>
      <div className="dice-buttons">
        {dice.map((sides) => (
          <button type="button" key={sides} onClick={() => props.onRoll(`d${sides}`, sides)}>
            d{sides}
          </button>
        ))}
      </div>
      <div className="roll-list">
        {props.rolls.length > 0 ? (
          props.rolls.map((roll) => (
            <div className="roll-card" key={roll.id}>
              <span>{roll.label}</span>
              <strong>{roll.total}</strong>
              <small>
                [{roll.rolls.join(", ")}] {roll.modifier ? signed(roll.modifier) : ""}
              </small>
            </div>
          ))
        ) : (
          <span className="muted-line">No rolls yet</span>
        )}
      </div>
    </aside>
  );
}
