import Image from "next/image";
import type { HeroClass } from "@/types/game";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";
import { CLASS_ART_IDS, classArtSrc } from "@/lib/classArt";
import { classCardDescription } from "./classPresentation";

/**
 * Compact horizontal catalog card: emblem + name + descriptor on the left,
 * existing class art fading in on the right (the gradient is a CSS
 * treatment in arcane-observatory.css, not baked into the image).
 *
 * `selected` = the class is committed to the draft; `previewed` = it is the
 * class currently inspected in the right workspace. Both states carry a
 * text marker so they never rely on color alone.
 */
export default function ClassCatalogCard(props: {
  heroClass: HeroClass;
  selected: boolean;
  previewed: boolean;
  onPreview: () => void;
}) {
  const { heroClass } = props;
  return (
    <button
      type="button"
      className="ao-class-card"
      data-class={heroClass.id}
      data-selected={props.selected || undefined}
      data-previewed={(props.previewed && !props.selected) || undefined}
      aria-pressed={props.selected}
      onClick={props.onPreview}
    >
      {CLASS_ART_IDS.has(heroClass.id) ? (
        <span className="ao-class-card-art" aria-hidden="true">
          <Image src={classArtSrc(heroClass.id)} alt="" fill sizes="(max-width: 760px) 90vw, 300px" />
        </span>
      ) : (
        <span className="ao-class-card-fallback" aria-hidden="true">
          <ClassIconPlaceholder classId={heroClass.id} size={56} strokeWidth={1.25} />
        </span>
      )}
      <span className="ao-class-card-emblem" aria-hidden="true">
        <ClassIconPlaceholder classId={heroClass.id} size={22} strokeWidth={1.5} />
      </span>
      <span className="ao-class-card-copy">
        <strong className="ao-class-card-name">{heroClass.name}</strong>
        <span className="ao-class-card-desc">{classCardDescription(heroClass)}</span>
      </span>
      {props.selected ? (
        <em className="ao-class-card-state">Chosen ✓</em>
      ) : props.previewed ? (
        <em className="ao-class-card-state previewing">Previewing</em>
      ) : null}
    </button>
  );
}
