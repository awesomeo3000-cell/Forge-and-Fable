import { Download, Plus } from "lucide-react";
import type { Character, Ruleset } from "@/types/game";
import CharacterPortrait from "@/components/portraits/CharacterPortrait";

/**
 * Your Heroes (dashboard handoff §10): real character cards — portrait, name,
 * level, class, campaign and an open action — instead of the old thin strip.
 * Portrait style labels are never shown; the selected portrait simply renders.
 */
export default function DashboardCharacters(props: {
  characters: Character[];
  ruleset: Ruleset | null;
  /** characterId → campaign name the hero is committed to, when known. */
  campaignByCharacter: Record<string, string>;
  onOpenCharacter: (characterId: string) => void;
  onCreateCharacter: () => void;
  onImportCharacter: () => void;
}) {
  if (props.characters.length === 0) {
    return (
      <div className="ao-hd-heroes-empty">
        <p>The roster is empty. Commission your first adventurer, or bring an existing hero into Dreamwright.</p>
        <div className="ao-hd-feature-actions">
          <button className="ao-hd-btn ao-hd-btn-primary" type="button" onClick={props.onCreateCharacter}>
            <Plus size={15} aria-hidden="true" /> Create a Character
          </button>
          <button className="ao-hd-btn" type="button" onClick={props.onImportCharacter}>
            <Download size={15} aria-hidden="true" /> Import
          </button>
        </div>
      </div>
    );
  }

  const heroLine = (character: Character) => {
    const race = props.ruleset?.races.find((item) => item.id === character.raceId)?.name;
    const heroClass = props.ruleset?.classes.find((item) => item.id === character.classId)?.name;
    return [`Level ${character.level}`, race, heroClass].filter(Boolean).join(" · ");
  };

  return (
    <ul className="ao-hd-hero-grid">
      {props.characters.slice(0, 6).map((character) => {
        const campaignName = props.campaignByCharacter[character.id];
        const incomplete = !character.classId || !character.raceId || !character.background;
        return (
          <li key={character.id}>
            <button type="button" className="ao-hd-hero-card" onClick={() => props.onOpenCharacter(character.id)}>
              <CharacterPortrait
                portraitId={character.portraitUrl || null}
                characterName={character.name}
                size={64}
                shape="rounded"
                className="ao-hd-hero-portrait"
              />
              <span className="ao-hd-hero-copy">
                <strong>{character.name || "Unnamed hero"}</strong>
                <small>{heroLine(character)}</small>
                <span className="ao-hd-hero-campaign">
                  {campaignName ? campaignName : "Not yet at a table"}
                </span>
              </span>
              {incomplete ? <span className="ao-hd-hero-flag" data-tone="warning">Unfinished</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
