import { memo } from "react";
import { conditionTone, type ImportantResource } from "@/lib/dmTable/party";
import type { CampaignMemberSummary } from "@/types/campaign";
import CharacterPortraitBase from "@/components/portraits/CharacterPortrait";

export const CharacterPortrait = memo(function CharacterPortrait({
  member,
  size = "rail",
}: {
  member: CampaignMemberSummary;
  size?: "rail" | "inspector";
}) {
  const name = member.characterName ?? member.userName;
  const portraitId = member.characterJson?.portraitUrl?.trim() || null;
  const px = size === "inspector" ? 58 : 54;
  return (
    <CharacterPortraitBase
      portraitId={portraitId}
      characterName={name}
      size={px}
      shape="circle"
      className={`dm-character-portrait is-${size}`}
    />
  );
});

export function ConditionChip({ label, concentration = false }: { label: string; concentration?: boolean }) {
  const tone = concentration ? "focus" : conditionTone(label);
  return <em className="dm-state-chip" data-tone={tone}>{label}</em>;
}

export function SpellSlotTrack({ slots, compact = false }: { slots: CampaignMemberSummary["spellSlots"]; compact?: boolean }) {
  if (!slots.length) return null;
  const description = slots.map((slot) => `level ${slot.level}: ${slot.remaining} of ${slot.max}`).join(", ");
  return (
    <span className={`dm-slot-track${compact ? " is-compact" : ""}`} aria-label={`Spell slots, ${description}`}>
      <small>Spell slots</small>
      {slots.slice(0, compact ? 4 : 9).map((slot) => (
        <span key={slot.level} className="dm-slot-level">
          <i>{slot.level}</i>
          {Array.from({ length: slot.max }, (_, index) => <b key={index} className={index >= slot.remaining ? "is-used" : ""} aria-hidden="true" />)}
        </span>
      ))}
    </span>
  );
}

export function ResourceChip({ resource, detailed = false }: { resource: ImportantResource; detailed?: boolean }) {
  return (
    <span className={`dm-resource-chip${detailed ? " is-detailed" : ""}`} data-tone={resource.tone}>
      <span>{detailed ? resource.label : resource.shortLabel}</span>
      <strong>{resource.current}/{resource.maximum}</strong>
      {detailed && resource.recharge !== "other" ? <small>{resource.recharge.replaceAll("-", " ")}</small> : null}
    </span>
  );
}
