import type { HeroClass } from "@/types/game";
import { mechanicalEssentials } from "./classPresentation";

/**
 * Mechanical Essentials (Orrery Path §13): a quiet two-column reference list
 * of the selected class's recorded mechanics, visually separate from the
 * required decisions below it.
 */
export default function ClassMechanics(props: { heroClass: HeroClass }) {
  return (
    <section className="ao-class-mechanics" aria-label="Mechanical essentials">
      <h4 className="ao-class-section-title">Mechanical Essentials</h4>
      <dl className="ao-class-mechanics-grid">
        {mechanicalEssentials(props.heroClass).map((row) => (
          <div className="ao-class-mechanics-item" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
