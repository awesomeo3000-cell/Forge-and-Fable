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
      aria-label={`${heroClass.name}${props.selected ? ", chosen" : props.previewed ? ", previewing" : ""}`}
      onClick={props.onPreview}
    >
      {CLASS_ART_IDS.has(heroClass.id) ? (
        <span className="ao-class-card-art" aria-hidden="true">
          {/* The banner art is height-driven under object-fit: cover (4:1 art
              in a ~2:1 box), so its effective rendered width is ~4× the card
              height — request derivatives sized for that, not the container. */}
          <Image src={classArtSrc(heroClass.id)} alt="" fill sizes="(max-width: 760px) 160vw, 520px" quality={90} />
        </span>
      ) : (
        <span className="ao-class-card-fallback" aria-hidden="true">
          <ClassIconPlaceholder classId={heroClass.id} size={56} strokeWidth={1.25} />
        </span>
      )}
      <span className="ao-class-card-emblem" aria-hidden="true">
        <ClassIconPlaceholder classId={heroClass.id} size={28} strokeWidth={1.5} />
      </span>
      <span className="ao-class-card-copy">
        <strong className="ao-class-card-name">{heroClass.name}</strong>
        <span className="ao-class-card-desc">{classCardDescription(heroClass)}</span>
      </span>
      {props.selected ? (
        <span className="ao-class-card-state" aria-hidden="true">
          <span className="ao-class-card-state-mark">✓</span> Chosen
        </span>
      ) : props.previewed ? (
        <span className="ao-class-card-state previewing" aria-hidden="true">
          <span className="ao-class-card-state-mark">◉</span> Previewing
        </span>
      ) : null}
    </button>
  );
}
