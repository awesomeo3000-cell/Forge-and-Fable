"use client";

import type { CharacterSettings } from "@/types/game";
import { sourceOptions } from "@/lib/utils";

import { memo } from "react";

export default memo(function SourceSettingsPanel(props: {
  selectedSourceIds: string[];
  settings: CharacterSettings;
  onToggleSource: (sourceId: string) => void;
  onSettingsChange: (settings: Partial<CharacterSettings>) => void;
}) {
  return (
    <div className="settings-panel">
      <section className="settings-section">
        <div className="settings-heading">
          <h3>Sources</h3>
          <p>
            You will only see character options from content you own and have enabled here in both the
            builder and your character sheet. Removing all sources will prevent you from being able to
            create a complete character.
          </p>
        </div>
        <div className="settings-list">
          {sourceOptions.map((source) => (
            <label className="checkbox-row source-row" key={source.id}>
              <input
                type="checkbox"
                checked={props.selectedSourceIds.includes(source.id)}
                onChange={() => props.onToggleSource(source.id)}
              />
              <span>
                <strong>{source.name}</strong>
                <small>{source.summary}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-heading">
          <h3>Dice Rolling</h3>
          <p>Enables digital dice rolling for all characters on this browser</p>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={props.settings.diceRollingEnabled}
            onChange={(event) =>
              props.onSettingsChange({ diceRollingEnabled: event.target.checked })
            }
          />
          <span>
            <strong>Enable Dice Rolling</strong>
          </span>
        </label>
      </section>

      <section className="settings-section">
        <div className="settings-heading">
          <h3>Optional Features</h3>
          <p>Allow or restrict optional features for this character</p>
        </div>
        <div className="settings-list compact">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.optionalClassFeatures}
              onChange={(event) =>
                props.onSettingsChange({ optionalClassFeatures: event.target.checked })
              }
            />
            <span>
              <strong>Optional Class Features</strong>
            </span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.customizeOrigin}
              onChange={(event) => props.onSettingsChange({ customizeOrigin: event.target.checked })}
            />
            <span>
              <strong>Customize Your Origin</strong>
            </span>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <div className="select-grid">
          <label className="control-field">
            <span>Hit Point Type</span>
            <small>
              Increase hit points by the fixed value or roll hit dice for higher starting levels.
            </small>
            <select
              value={props.settings.hitPointType}
              onChange={(event) =>
                props.onSettingsChange({
                  hitPointType: event.target.value as CharacterSettings["hitPointType"],
                })
              }
            >
              <option value="fixed">Fixed</option>
              <option value="rolled">Rolled</option>
              <option value="manual">Manual</option>
            </select>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-heading">
          <h3>Use Prerequisites</h3>
          <p>
            Allow or restrict choices based on rule prerequisites for the following for this
            character
          </p>
        </div>
        <div className="settings-list compact">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.useFeatPrerequisites}
              onChange={(event) =>
                props.onSettingsChange({ useFeatPrerequisites: event.target.checked })
              }
            />
            <span>
              <strong>Feats</strong>
            </span>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <div className="select-grid">
          <label className="control-field">
            <span>Encumbrance Type</span>
            <small>
              Use the standard encumbrance rules / Disable the encumbrance display / Use the more
              detailed rules for encumbrance
            </small>
            <select
              value={props.settings.encumbranceType}
              onChange={(event) =>
                props.onSettingsChange({
                  encumbranceType: event.target.value as CharacterSettings["encumbranceType"],
                })
              }
            >
              <option value="standard">Use Encumbrance</option>
              <option value="none">Disable Encumbrance</option>
              <option value="variant">Variant Encumbrance</option>
            </select>
          </label>
        </div>
        <div className="settings-list compact">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.ignoreCoinWeight}
              onChange={(event) => props.onSettingsChange({ ignoreCoinWeight: event.target.checked })}
            />
            <span>
              <strong>Ignore Coin Weight</strong>
              <small>Coins do not count against your total weight carried (50 coins weigh 1 lb.)</small>
            </span>
          </label>
        </div>
      </section>
    </div>
  );
})
