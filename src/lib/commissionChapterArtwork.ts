/**
 * Arcane Storybook chapter artwork registry (art-integration handoff §8).
 * The single home for commission chapter art — components resolve artwork
 * through this map; do not scatter asset paths through chapter components.
 *
 * Masters live in assets/chapters/{1-7}.png (2944×1648); the WebP
 * derivatives in public/commission/ are generated from them:
 *   {id}-banner.webp         1920×720  (8:3 desktop banner crop)
 *   {id}-banner-mobile.webp   900×600  (3:2 art-directed mobile crop)
 *   {id}-backdrop.webp       1920×1075 (full-frame, backdrop mode)
 */

export type CommissionChapterId =
  | "provenance"
  | "likeness"
  | "vocation"
  | "origin"
  | "lineage"
  | "attributes"
  | "seal";

/** Chapter order — index-aligned with CreatorPanel's `steps` array. */
export const COMMISSION_CHAPTER_IDS: CommissionChapterId[] = [
  "provenance",
  "likeness",
  "vocation",
  "origin",
  "lineage",
  "attributes",
  "seal",
];

export type CommissionChapterArtwork = {
  bannerSrc: string;
  mobileBannerSrc: string;
  backdropSrc: string;
  /** Compact label chip shown over the banner art. */
  label: string;
  /** Empty by default — the art is decorative; chapter info lives in the copy. */
  alt: string;
  /** Focal point for the banner <img> (CSS object-position). */
  objectPosition: string;
  /** Focal point for backdrop mode (CSS background-position). */
  backdropPosition: string;
};

const art = (
  id: CommissionChapterId,
  label: string,
  objectPosition = "center",
  backdropPosition = "center",
): CommissionChapterArtwork => ({
  bannerSrc: `/commission/${id}-banner.webp`,
  mobileBannerSrc: `/commission/${id}-banner-mobile.webp`,
  backdropSrc: `/commission/${id}-backdrop.webp`,
  label,
  alt: "",
  objectPosition,
  backdropPosition,
});

export const COMMISSION_CHAPTER_ARTWORK: Record<CommissionChapterId, CommissionChapterArtwork> = {
  provenance: art("provenance", "The first page of the commission", "center 55%"),
  likeness: art("likeness", "An artist's observatory corner", "center"),
  vocation: art("vocation", "Arcane hall of callings", "center 60%"),
  origin: art("origin", "A cabinet of past lives", "center"),
  lineage: art("lineage", "A storybook naturalist's gallery", "center 60%"),
  attributes: art("attributes", "An enchanted measuring chamber", "center 60%"),
  seal: art("seal", "The finished record and final seal", "center", "center 40%"),
};

/** Artwork for a step index (CreatorPanel), or null when out of range. */
export function chapterArtworkForStep(step: number): CommissionChapterArtwork | null {
  const id = COMMISSION_CHAPTER_IDS[step];
  return id ? COMMISSION_CHAPTER_ARTWORK[id] : null;
}
