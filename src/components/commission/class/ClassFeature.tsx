import Image from "next/image";
import type { HeroClass } from "@/types/game";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";
import { CLASS_ART_IDS, classArtSrc } from "@/lib/classArt";
import { classRoleLine, classTags } from "./classPresentation";

/**
 * Selected Class Feature (Orrery Path §11): the strongest presentation card
 * in the chapter — existing class art, emblem, identity line, tags, and the
 * primary Select action beside the full-guide (class detail modal) action.
 */
export default function ClassFeature(props: {
  heroClass: HeroClass;
  confirmed: boolean;
  onConfirm: () => void;
  onInspect: () => void;
}) {
  const { heroClass } = props;
  return (
    <section className="ao-class-feature" data-class={heroClass.id} aria-labelledby="ao-class-feature-name">
      {/* The repository art is a wide landscape composition with calm negative
          space on the left. Keep the image full-bleed so the identity can sit
          over that quiet side without inventing new artwork. */}
      <div className="ao-class-feature-art">
        {CLASS_ART_IDS.has(heroClass.id) ? (
          <Image src={classArtSrc(heroClass.id)} alt="" fill sizes="(max-width: 980px) 100vw, 920px" />
        ) : (
          <span className="ao-class-feature-art-fallback" aria-hidden="true">
            <ClassIconPlaceholder classId={heroClass.id} size={96} strokeWidth={1.25} />
          </span>
        )}
      </div>
      <div className="ao-class-feature-body">
        <div className="ao-class-feature-identity">
          <span className="ao-class-feature-emblem" aria-hidden="true">
            <ClassIconPlaceholder classId={heroClass.id} size={30} strokeWidth={1.5} />
          </span>
          <div>
            <h4 className="ao-class-feature-name" id="ao-class-feature-name">
              {heroClass.name}
            </h4>
            <p className="ao-class-feature-role">{classRoleLine(heroClass)}</p>
          </div>
        </div>
        <p className="ao-class-feature-summary">{heroClass.summary}</p>
        <ul className="ao-class-feature-tags">
          {classTags(heroClass).map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <div className="ao-class-feature-actions">
          <button
            type="button"
            className="ao-class-cta"
            data-confirmed={props.confirmed || undefined}
            aria-pressed={props.confirmed}
            onClick={props.onConfirm}
          >
            {props.confirmed ? `${heroClass.name} chosen ✓` : `Select ${heroClass.name}`}
          </button>
          <button type="button" className="ao-class-guide" aria-haspopup="dialog" onClick={props.onInspect}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M4 5.5C4 4.7 4.7 4 5.5 4H11c.8 0 1.5.7 1.5 1.5V20c0-.8-.7-1.5-1.5-1.5H4Zm16 0c0-.8-.7-1.5-1.5-1.5H13c-.8 0-1.5.7-1.5 1.5V20c0-.8.7-1.5 1.5-1.5h7Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            View Full Guide
          </button>
        </div>
      </div>
    </section>
  );
}
