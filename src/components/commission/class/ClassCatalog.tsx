import type { HeroClass } from "@/types/game";
import ClassCatalogCard from "./ClassCatalogCard";

/**
 * Left region of the Orrery Path class workspace: search, a truthful result
 * count, and the scrollable class grid. Filtering happens in the parent so
 * the count and grid can never disagree.
 */
export default function ClassCatalog(props: {
  classes: HeroClass[];
  totalCount: number;
  query: string;
  onQueryChange: (query: string) => void;
  selectedClassId: string | null;
  previewedClassId: string | null;
  onPreview: (classId: string) => void;
}) {
  const showing =
    props.classes.length === props.totalCount
      ? `Showing ${props.totalCount} classes`
      : `Showing ${props.classes.length} of ${props.totalCount} classes`;

  return (
    <section className="ao-class-catalog" aria-label="Class catalog">
      <div className="ao-class-catalog-tools">
        <input
          type="search"
          className="ao-class-search"
          value={props.query}
          placeholder="Search classes…"
          aria-label="Search classes"
          onChange={(event) => props.onQueryChange(event.target.value)}
        />
        <p className="ao-class-count" aria-live="polite">
          {showing}
        </p>
      </div>
      <div className="ao-class-catalog-scroll">
        {props.classes.length > 0 ? (
          <div className="ao-class-catalog-grid">
            {props.classes.map((heroClass) => (
              <ClassCatalogCard
                key={heroClass.id}
                heroClass={heroClass}
                selected={heroClass.id === props.selectedClassId}
                previewed={heroClass.id === props.previewedClassId}
                onPreview={() => props.onPreview(heroClass.id)}
              />
            ))}
          </div>
        ) : (
          <p className="ao-class-catalog-empty">
            No classes match “{props.query.trim()}”. Clear the search to see the full catalog.
          </p>
        )}
      </div>
    </section>
  );
}
