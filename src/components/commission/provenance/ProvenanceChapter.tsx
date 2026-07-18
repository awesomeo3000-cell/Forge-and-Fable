"use client";

import type { CharacterSettings, DraftCharacter } from "@/types/game";
import { sourceOptions } from "@/lib/utils";

/** Marker chip per source card, derived from the source name so it always
    reflects current data (complete-commission handoff §5). */
function sourceMarker(name: string): string {
  if (/homebrew/i.test(name)) return "Homebrew";
  if (/^5e\b/i.test(name)) return /expanded/i.test(name) ? "Legacy expanded" : "Legacy core";
  return /expanded/i.test(name) ? "Expanded" : "Recommended";
}

/**
 * Chapter I workspace (complete-commission handoff §5): the name is the
 * chapter's primary decision, sources become selectable cards, builder
 * preferences separate from content sources, and a commission summary
 * mirrors the draft. CreatorPanel stays the state owner — every control
 * routes through the same handlers the old settings rows used.
 */
export default function ProvenanceChapter(props: {
  draft: DraftCharacter;
  onDraftChange: (draft: DraftCharacter) => void;
  onToggleSource: (sourceId: string) => void;
  onSettingsChange: (settings: Partial<CharacterSettings>) => void;
  onChangeLevel: (level: number) => void;
}) {
  const { draft } = props;
  const nameMissing = !draft.name.trim();
  const sourcesMissing = draft.sourceIds.length === 0;
  const complete = !nameMissing && !sourcesMissing;

  const preferenceToggles: Array<{
    key: "diceRollingEnabled" | "optionalClassFeatures" | "customizeOrigin" | "useFeatPrerequisites";
    label: string;
    detail: string;
  }> = [
    { key: "diceRollingEnabled", label: "Dice rolling", detail: "Enables digital dice rolling for all characters on this browser." },
    { key: "optionalClassFeatures", label: "Optional class features", detail: "Allow optional features for this character." },
    { key: "customizeOrigin", label: "Customize your origin", detail: "Loosen origin packages for a personal starting story." },
    { key: "useFeatPrerequisites", label: "Feat prerequisites", detail: "Restrict feat choices to those whose prerequisites are met." },
  ];

  return (
    <div className="ao-provenance">
      <div className="ao-provenance-top">
        {/* Identity: the primary decision, not one thin input above a list. */}
        <section className="ao-major-card ao-identity-card" aria-labelledby="ao-identity-title">
          <h4 className="ao-card-title" id="ao-identity-title">Identity</h4>
          <label className="ao-identity-name">
            <span className="ao-field-label">Character name</span>
            <input
              value={draft.name}
              placeholder="Write a name"
              onChange={(event) => props.onDraftChange({ ...draft, name: event.target.value })}
            />
            <small className={`ao-field-note${nameMissing ? " pending" : ""}`}>
              {nameMissing ? "Required — the commission opens with a name." : "Recorded in the commission."}
            </small>
          </label>
          <label className="ao-identity-level">
            <span className="ao-field-label">Starting level</span>
            <input
              type="number"
              min={1}
              max={20}
              value={draft.level}
              onChange={(event) => {
                const value = parseInt(event.target.value, 10);
                if (!isNaN(value)) props.onChangeLevel(value);
              }}
            />
            <small className="ao-field-note">1 – 20 · hit points and features follow the level.</small>
          </label>
        </section>

        {/* Commission summary: mirrors draft state, never duplicates it. */}
        <aside className="ao-summary-card" aria-label="Commission summary">
          <h4 className="ao-card-title">Commission summary</h4>
          <dl className="ao-summary-rows">
            <div><dt>Name</dt><dd className={nameMissing ? "missing" : ""}>{draft.name.trim() || "unwritten"}</dd></div>
            <div><dt>Level</dt><dd>{draft.level}</dd></div>
            <div>
              <dt>Sources</dt>
              <dd className={sourcesMissing ? "missing" : ""}>
                {sourcesMissing ? "none enabled" : `${draft.sourceIds.length} enabled`}
              </dd>
            </div>
            <div><dt>Dice rolling</dt><dd>{draft.settings.diceRollingEnabled ? "enabled" : "off"}</dd></div>
            <div><dt>Optional features</dt><dd>{draft.settings.optionalClassFeatures ? "allowed" : "off"}</dd></div>
            <div><dt>Hit points</dt><dd>{draft.settings.hitPointType}</dd></div>
          </dl>
          <p className={`ao-summary-status${complete ? " done" : ""}`} aria-live="polite">
            {complete
              ? "Chapter complete — the record can turn the page."
              : nameMissing && sourcesMissing
                ? "Write a name and enable at least one source."
                : nameMissing
                  ? "Write a name to continue."
                  : "Enable at least one source to continue."}
          </p>
        </aside>
      </div>

      <section className="ao-major-card" aria-labelledby="ao-sources-title">
        <h4 className="ao-card-title" id="ao-sources-title">Rules sources</h4>
        <p className="ao-card-sub">
          You will only see character options from content enabled here, in both the builder and the
          character sheet. Removing all sources prevents a complete character.
        </p>
        <div className="ao-source-grid">
          {sourceOptions.map((source) => {
            const enabled = draft.sourceIds.includes(source.id);
            return (
              <label key={source.id} className={`ao-source-card${enabled ? " enabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => props.onToggleSource(source.id)}
                />
                <span className="ao-source-card-copy">
                  <span className="ao-source-card-head">
                    <strong>{source.name}</strong>
                    <em className="ao-source-marker">{sourceMarker(source.name)}</em>
                  </span>
                  <small>{source.summary}</small>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="ao-major-card" aria-labelledby="ao-prefs-title">
        <h4 className="ao-card-title" id="ao-prefs-title">Builder preferences</h4>
        <p className="ao-card-sub">Table preferences, separate from content sources.</p>
        <div className="ao-pref-grid">
          {preferenceToggles.map((pref) => (
            <label key={pref.key} className={`ao-pref-card${draft.settings[pref.key] ? " enabled" : ""}`}>
              <input
                type="checkbox"
                checked={Boolean(draft.settings[pref.key])}
                onChange={(event) => props.onSettingsChange({ [pref.key]: event.target.checked })}
              />
              <span className="ao-source-card-copy">
                <strong>{pref.label}</strong>
                <small>{pref.detail}</small>
              </span>
            </label>
          ))}
          <label className="ao-pref-card ao-pref-select">
            <span className="ao-source-card-copy">
              <strong>Hit point type</strong>
              <small>Fixed value per level, rolled hit dice, or manual entry.</small>
            </span>
            <select
              value={draft.settings.hitPointType}
              onChange={(event) =>
                props.onSettingsChange({ hitPointType: event.target.value as CharacterSettings["hitPointType"] })
              }
            >
              <option value="fixed">Fixed</option>
              <option value="rolled">Rolled</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="ao-pref-card ao-pref-select disabled" aria-disabled="true">
            <span className="ao-source-card-copy">
              <strong>Encumbrance <em className="cs-coming-soon">Coming soon</em></strong>
              <small>Standard, disabled, or variant carrying rules.</small>
            </span>
            <select value={draft.settings.encumbranceType} disabled>
              <option value="standard">Use Encumbrance</option>
              <option value="none">Disable Encumbrance</option>
              <option value="variant">Variant Encumbrance</option>
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
