"use client";

import { useState } from "react";
import type { DraftCharacter, Race } from "@/types/game";
import { abilityLabels, signed } from "@/lib/utils";
import { firstSentence } from "@/lib/ledgerCopy";
import SpeciesIconPlaceholder from "@/components/icons/SpeciesIcon";
import {
  FAMILY_LABELS,
  groupSpeciesByFamily,
  groupTraits,
  parseSpeciesName,
  speciesDetailLine,
} from "./lineagePresentation";

function bonusChips(race: Race): string[] {
  const chips = Object.entries(race.bonuses)
    .filter(([, value]) => value)
    .map(([key, value]) => `${signed(value as number)} ${abilityLabels[key as keyof typeof abilityLabels]}`);
  if (race.bonusChoices) {
    chips.push(`+1 to ${race.bonusChoices} scores of your choice`);
  }
  return chips;
}

/**
 * Chapter V workspace (complete-commission handoff §7): family-first
 * browsing on the left, the selected lineage as a storybook feature on the
 * right — curious and magical, not clinical. Families expand into a variant
 * list in the feature panel; the existing SpeciesLearnModal remains the
 * full rules reference (via onInspectRace). CreatorPanel owns all state.
 */
export default function LineageChapter(props: {
  races: Race[];
  draft: DraftCharacter;
  onSelectRace: (raceId: string) => void;
  onInspectRace: (raceId: string) => void;
}) {
  const groups = groupSpeciesByFamily(props.races);
  // Preview key: a race id, or "family:<id>" while browsing a family.
  const [previewedKey, setPreviewedKey] = useState<string | null>(null);

  const confirmedRace = props.races.find((race) => race.id === props.draft.raceId) ?? null;
  const previewedFamilyId = previewedKey?.startsWith("family:") ? previewedKey.slice(7) : null;
  const previewedFamily = previewedFamilyId
    ? groups.find((group) => group.kind === "family" && group.familyId === previewedFamilyId)
    : null;
  const previewedRace = !previewedFamilyId && previewedKey
    ? props.races.find((race) => race.id === previewedKey) ?? null
    : null;
  const displayedRace = previewedRace ?? (previewedFamily ? null : confirmedRace);

  const renderFeature = (race: Race) => {
    const { displayName } = parseSpeciesName(race.name);
    const isConfirmed = race.id === props.draft.raceId;
    const traits = groupTraits(race);
    const chips = bonusChips(race);
    return (
      <section className="ao-feature-card ao-lineage-feature" data-species={race.id}>
        <span className="ao-feature-kicker">{isConfirmed ? "Sealed lineage" : "Previewed lineage"}</span>
        <div className="ao-lineage-feature-head">
          <span className="ao-lineage-feature-icon" data-species={race.id} aria-hidden="true">
            <SpeciesIconPlaceholder speciesId={race.id} size={34} strokeWidth={1.5} />
          </span>
          <div>
            <h4 className="ao-feature-title">{displayName}</h4>
            <p className="ao-feature-sub">{firstSentence(race.summary, 120)}</p>
          </div>
        </div>

        <dl className="ao-feature-facts">
          <div><dt>Body</dt><dd>{speciesDetailLine(race)}</dd></div>
          {chips.length > 0 ? <div><dt>Ability scores</dt><dd>{chips.join(", ")}</dd></div> : null}
          {traits.senses.length > 0 ? (
            <div><dt>Senses</dt><dd>{traits.senses.map((trait) => trait.name).join(", ")}</dd></div>
          ) : null}
          {traits.languages.length > 0 ? (
            <div><dt>Languages</dt><dd>{traits.languages.map((trait) => trait.name).join(", ")}</dd></div>
          ) : null}
        </dl>

        {traits.heritage.length > 0 ? (
          <div className="ao-lineage-traits">
            <h5 className="ao-lineage-traits-title">Heritage abilities</h5>
            <ul>
              {traits.heritage.map((trait) => (
                <li key={trait.name}>
                  <strong>{trait.name}</strong>
                  <span>{firstSentence(trait.description, 90)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {race.bonusChoices ? (
          <p className="ao-lineage-note">
            {`Requires a decision: choose ${race.bonusChoices} ability score${race.bonusChoices > 1 ? "s" : ""} to raise — made in Chapter VI, Attributes.`}
          </p>
        ) : null}

        <div className="ao-feature-actions">
          {isConfirmed ? (
            <p className="ao-feature-confirmed">This lineage is sealed in the commission.</p>
          ) : (
            <button
              type="button"
              className="ledger-button ledger-button-primary ao-feature-confirm"
              onClick={() => {
                props.onSelectRace(race.id);
                setPreviewedKey(race.id);
              }}
            >
              {`Seal the ${displayName} lineage`}
            </button>
          )}
          <button type="button" className="ledger-button" onClick={() => props.onInspectRace(race.id)}>
            Read the full entry
          </button>
        </div>
      </section>
    );
  };

  return (
    <div className="ao-commission-workspace ao-lineage">
      <section className="ao-catalog" aria-label="Lineage families">
        <div className="ao-catalog-head">
          <span className="ao-catalog-count">{`${groups.length} families`}</span>
        </div>
        <div className="ao-catalog-grid">
          {groups.map((group) => {
            if (group.kind === "single") {
              const race = group.race;
              const { displayName, subspeciesLabel } = parseSpeciesName(race.name);
              const active = race.id === props.draft.raceId;
              const previewing = displayedRace?.id === race.id && !active;
              return (
                <button
                  type="button"
                  key={race.id}
                  className={`ao-catalog-card ao-lineage-card${active ? " selected" : ""}${previewing ? " previewed" : ""}`}
                  data-species={race.id}
                  aria-pressed={active}
                  onClick={() => setPreviewedKey(race.id)}
                >
                  <span className="ao-catalog-card-head">
                    <span className="ao-lineage-card-icon" data-species={race.id} aria-hidden="true">
                      <SpeciesIconPlaceholder speciesId={race.id} size={24} strokeWidth={1.5} />
                    </span>
                    <strong>{displayName}</strong>
                    {active ? <em className="ao-catalog-card-state">Sealed ✦</em> : null}
                  </span>
                  <span className="ao-catalog-card-desc">{firstSentence(race.summary, 60)}</span>
                  {subspeciesLabel ? (
                    <span className="ao-catalog-card-grants">{subspeciesLabel}</span>
                  ) : null}
                </button>
              );
            }

            const family = FAMILY_LABELS[group.familyId] ?? { name: group.familyId, summary: "" };
            const familyHasSelection = group.members.some((member) => member.id === props.draft.raceId);
            const browsing = previewedFamilyId === group.familyId;
            return (
              <button
                type="button"
                key={group.familyId}
                className={`ao-catalog-card ao-lineage-card${familyHasSelection ? " selected" : ""}${browsing && !familyHasSelection ? " previewed" : ""}`}
                aria-pressed={familyHasSelection}
                onClick={() => setPreviewedKey(`family:${group.familyId}`)}
              >
                <span className="ao-catalog-card-head">
                  <span className="ao-lineage-card-icon" aria-hidden="true">
                    <SpeciesIconPlaceholder speciesId={group.members[0]?.id ?? ""} size={24} strokeWidth={1.5} />
                  </span>
                  <strong>{family.name}</strong>
                  {familyHasSelection ? <em className="ao-catalog-card-state">Sealed ✦</em> : null}
                </span>
                <span className="ao-catalog-card-desc">{firstSentence(family.summary, 60)}</span>
                <span className="ao-catalog-card-grants">{`${group.members.length} lineages`}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="ao-detail-stack">
        {previewedFamily && previewedFamily.kind === "family" ? (
          <section className="ao-feature-card ao-lineage-family">
            <span className="ao-feature-kicker">Family</span>
            <h4 className="ao-feature-title">
              {(FAMILY_LABELS[previewedFamily.familyId] ?? { name: previewedFamily.familyId }).name}
            </h4>
            <p className="ao-feature-sub">
              {(FAMILY_LABELS[previewedFamily.familyId] ?? { summary: "" }).summary ?? ""}
            </p>
            <div className="ao-lineage-variants">
              {previewedFamily.members.map((member) => {
                const { displayName } = parseSpeciesName(member.name);
                const active = member.id === props.draft.raceId;
                return (
                  <button
                    type="button"
                    key={member.id}
                    className={`ao-lineage-variant${active ? " selected" : ""}`}
                    aria-pressed={active}
                    onClick={() => setPreviewedKey(member.id)}
                  >
                    <strong>{displayName}</strong>
                    <span>{speciesDetailLine(member)}</span>
                    <em>{active ? "Sealed ✦" : "Preview →"}</em>
                  </button>
                );
              })}
            </div>
          </section>
        ) : displayedRace ? (
          renderFeature(displayedRace)
        ) : (
          <div className="ao-detail-empty">
            <strong>Choose a lineage</strong>
            <p>Blood, and what it carries. Pick a family from the gallery to preview it here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
