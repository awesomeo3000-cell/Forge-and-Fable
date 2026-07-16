"use client";

import { useState } from "react";
import type { DraftCharacter } from "@/types/game";
import { originTone } from "@/lib/ledgerCopy";
import {
  BACKGROUND_LANGUAGE_CHOICES,
  BACKGROUND_SKILLS,
  BACKGROUND_TOOL_CHOICES,
  BACKGROUND_TOOL_GRANTS,
  LANGUAGES,
  SKILLS,
} from "@/lib/srd";

function skillNames(ids: string[] | undefined): string[] {
  return (ids ?? []).map((id) => SKILLS.find((skill) => skill.id === id)?.name ?? id);
}

function originDescriptor(background: string): string {
  return background === "Custom Background"
    ? "a personal story, written at the table"
    : `a ${background.toLowerCase()} starting story`;
}

/**
 * Chapter IV workspace (complete-commission handoff §6): origin catalog on
 * the left, selected-origin feature and required decisions on the right —
 * personal and narrative rather than administrative. Same preview/confirm
 * grammar as the Vocation chapter: clicking a card previews, the feature's
 * primary action records it (via onSelectBackground, which clears dependent
 * picks exactly as before). CreatorPanel remains the state owner.
 */
export default function OriginChapter(props: {
  backgrounds: string[];
  alignments: string[];
  draft: DraftCharacter;
  onDraftChange: (draft: DraftCharacter) => void;
  onSelectBackground: (background: string) => void;
  onToggleTool: (tool: string, options: string[], count: number) => void;
  onToggleLanguage: (language: string) => void;
}) {
  const [previewedBackground, setPreviewedBackground] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const confirmed = props.draft.background;
  const displayed = previewedBackground ?? (confirmed || null);
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? props.backgrounds.filter((background) =>
        `${background} ${originDescriptor(background)}`.toLowerCase().includes(needle),
      )
    : props.backgrounds;

  const displayedSkills = displayed ? skillNames(BACKGROUND_SKILLS[displayed]) : [];
  const displayedToolGrants = displayed ? BACKGROUND_TOOL_GRANTS[displayed] ?? [] : [];
  const displayedToolChoice = displayed ? BACKGROUND_TOOL_CHOICES[displayed] : undefined;
  const displayedLanguageCount = displayed ? BACKGROUND_LANGUAGE_CHOICES[displayed] ?? 0 : 0;
  const isConfirmed = Boolean(displayed) && displayed === confirmed;

  const confirmedToolChoice = confirmed ? BACKGROUND_TOOL_CHOICES[confirmed] : undefined;
  const confirmedLanguageCount = confirmed ? BACKGROUND_LANGUAGE_CHOICES[confirmed] ?? 0 : 0;

  return (
    <div className="ao-origin">
      <div className="ao-commission-workspace">
        <section className="ao-catalog" aria-label="Origin catalog">
          <div className="ao-catalog-head">
            <input
              className="ao-catalog-search"
              value={query}
              placeholder="Search origins..."
              aria-label="Search origins"
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="ao-catalog-count">
              {filtered.length === props.backgrounds.length
                ? `${props.backgrounds.length} origins`
                : `${filtered.length} of ${props.backgrounds.length} origins`}
            </span>
          </div>
          <div className="ao-catalog-grid">
            {filtered.map((background) => {
              const grants = skillNames(BACKGROUND_SKILLS[background]).slice(0, 3);
              const active = background === confirmed;
              const previewing = background === displayed && !active;
              return (
                <button
                  type="button"
                  key={background}
                  className={`ao-catalog-card${active ? " selected" : ""}${previewing ? " previewed" : ""}`}
                  data-origin-tone={originTone(background)}
                  aria-pressed={active}
                  onClick={() => setPreviewedBackground(background)}
                >
                  <span className="ao-catalog-card-head">
                    <span className="ao-catalog-card-dot" aria-hidden="true" />
                    <strong>{background}</strong>
                    {active ? <em className="ao-catalog-card-state">Recorded ✦</em> : null}
                  </span>
                  <span className="ao-catalog-card-desc">{originDescriptor(background)}</span>
                  {grants.length > 0 ? (
                    <span className="ao-catalog-card-grants">{grants.join(" · ")}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <div className="ao-detail-stack">
          {displayed ? (
            <>
              <section className="ao-feature-card" data-origin-tone={originTone(displayed)}>
                <span className="ao-feature-kicker">{isConfirmed ? "Recorded origin" : "Previewed origin"}</span>
                <h4 className="ao-feature-title">{displayed}</h4>
                <p className="ao-feature-sub">{originDescriptor(displayed)}</p>
                <dl className="ao-feature-facts">
                  {displayedSkills.length > 0 ? (
                    <div><dt>Skill proficiencies</dt><dd>{displayedSkills.join(", ")}</dd></div>
                  ) : null}
                  {displayedToolGrants.length > 0 ? (
                    <div><dt>Tool proficiencies</dt><dd>{displayedToolGrants.join(", ")}</dd></div>
                  ) : null}
                  {displayedToolChoice ? (
                    <div><dt>Tools</dt><dd>{`Choose ${displayedToolChoice.count}`}</dd></div>
                  ) : null}
                  {displayedLanguageCount > 0 ? (
                    <div><dt>Languages</dt><dd>{`Choose ${displayedLanguageCount}`}</dd></div>
                  ) : null}
                </dl>
                {isConfirmed ? (
                  <p className="ao-feature-confirmed">This origin is recorded in the commission.</p>
                ) : (
                  <button
                    type="button"
                    className="ledger-button ledger-button-primary ao-feature-confirm"
                    onClick={() => {
                      props.onSelectBackground(displayed);
                      setPreviewedBackground(null);
                    }}
                  >
                    {`Record the ${displayed === "Custom Background" ? "custom origin" : displayed}`}
                  </button>
                )}
              </section>

              {isConfirmed && confirmedToolChoice ? (
                <section className="ao-decision-card">
                  <div className="ao-decision-head">
                    <h5>Choose a tool</h5>
                    <span
                      className={`ao-decision-count${
                        props.draft.toolProficiencies.filter((tool) => confirmedToolChoice.options.includes(tool)).length >= confirmedToolChoice.count
                          ? " done"
                          : ""
                      }`}
                    >
                      {`${props.draft.toolProficiencies.filter((tool) => confirmedToolChoice.options.includes(tool)).length}/${confirmedToolChoice.count} chosen`}
                    </span>
                  </div>
                  <div className="dj-skill-chips">
                    {confirmedToolChoice.options.map((tool) => {
                      const picked = props.draft.toolProficiencies.includes(tool);
                      const chosenInPool = props.draft.toolProficiencies.filter((item) =>
                        confirmedToolChoice.options.includes(item),
                      ).length;
                      const full = !picked && chosenInPool >= confirmedToolChoice.count;
                      return (
                        <button
                          key={tool}
                          type="button"
                          className={`dj-skill-chip${picked ? " picked" : ""}`}
                          aria-pressed={picked}
                          disabled={full}
                          onClick={() => props.onToggleTool(tool, confirmedToolChoice.options, confirmedToolChoice.count)}
                        >
                          {tool}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {isConfirmed && confirmedLanguageCount > 0 ? (
                <section className="ao-decision-card">
                  <div className="ao-decision-head">
                    <h5>Languages</h5>
                    <span className={`ao-decision-count${props.draft.languages.length >= confirmedLanguageCount ? " done" : ""}`}>
                      {`${props.draft.languages.length}/${confirmedLanguageCount} chosen`}
                    </span>
                  </div>
                  <div className="dj-skill-chips">
                    {LANGUAGES.map((language) => {
                      const picked = props.draft.languages.includes(language);
                      const full = !picked && props.draft.languages.length >= confirmedLanguageCount;
                      return (
                        <button
                          key={language}
                          type="button"
                          className={`dj-skill-chip${picked ? " picked" : ""}`}
                          aria-pressed={picked}
                          disabled={full}
                          onClick={() => props.onToggleLanguage(language)}
                        >
                          {language}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <div className="ao-detail-empty">
              <strong>Choose an origin</strong>
              <p>Who were they, before the road? Pick an origin from the catalog to preview it here.</p>
            </div>
          )}
        </div>
      </div>

      <section className="ao-major-card ao-origin-narrative" aria-labelledby="ao-origin-narrative-title">
        <h4 className="ao-card-title" id="ao-origin-narrative-title">Narrative texture</h4>
        <p className="ao-card-sub">Optional — these lines travel with the finished record.</p>
        <label className="control-field ao-origin-alignment">
          <span>Alignment</span>
          <select
            value={props.draft.alignment}
            onChange={(event) => props.onDraftChange({ ...props.draft, alignment: event.target.value })}
          >
            {props.alignments.map((alignment) => (
              <option key={alignment} value={alignment}>
                {alignment}
              </option>
            ))}
          </select>
        </label>
        <div className="dj-notes-grid">
          <label className="control-field narrative-field">
            <span>Physical characteristics</span>
            <textarea
              value={props.draft.physicalCharacteristics}
              placeholder="Appearance, age, clothing, scars, posture, voice..."
              onChange={(event) =>
                props.onDraftChange({ ...props.draft, physicalCharacteristics: event.target.value })
              }
            />
          </label>
          <label className="control-field narrative-field">
            <span>Personal characteristics</span>
            <textarea
              value={props.draft.personalCharacteristics}
              placeholder="Ideals, bonds, flaws, habits, fears, mannerisms..."
              onChange={(event) =>
                props.onDraftChange({ ...props.draft, personalCharacteristics: event.target.value })
              }
            />
          </label>
          <label className="control-field narrative-field wide">
            <span>General notes</span>
            <textarea
              value={props.draft.generalNotes}
              placeholder="Backstory hooks, goals, campaign notes, table reminders..."
              onChange={(event) =>
                props.onDraftChange({ ...props.draft, generalNotes: event.target.value })
              }
            />
          </label>
        </div>
      </section>
    </div>
  );
}
