/** Classes with painted banner art at public/class-art-hq/{id}.webp. The
    high-resolution derivatives are generated from the 2508x627 source masters
    in assets/Class Cards/. Classes outside this set fall back to the engraved
    class icon. */
export const CLASS_ART_IDS = new Set([
  "artificer", "barbarian", "bard", "cleric", "druid", "fighter",
  "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
]);

/* Next's localPatterns config forbids query strings on local image srcs, so
   cache-bust art swaps by renaming the file, not by versioning the URL. */
export function classArtSrc(classId: string): string {
  return `/class-art-hq/${classId}.webp`;
}
