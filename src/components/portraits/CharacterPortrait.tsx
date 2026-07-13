"use client";

import { memo, useState, useCallback, type CSSProperties } from "react";
import { resolvePortraitSrc, isCatalogPortrait, portraitFrameCss } from "@/data/portraits";

export type CharacterPortraitProps = {
  /** Opaque portrait ID (catalog lookup) or direct image URL. */
  portraitId?: string | null;
  /** Character name — used for initials fallback and accessible label. */
  characterName: string;
  /** Pixel dimensions. Default 56. */
  size?: number;
  /** Shape variant. Default "circle". */
  shape?: "circle" | "rounded";
  /** When true the image is decorative (no alt text, aria-hidden). */
  decorative?: boolean;
  className?: string;
};

/**
 * Shared portrait renderer. Resolves an opaque catalog portrait ID to its
 * image source, falls back to styled initials, and never exposes internal
 * ancestry or presentation metadata to the player.
 *
 * Catalog portraits render as a framed background (recentering the painted
 * face circle in the loosely-cropped source art); external URLs render as a
 * plain <img> so load errors can fall back to initials.
 */
export default memo(function CharacterPortrait({
  portraitId,
  characterName,
  size = 56,
  shape = "circle",
  decorative = false,
  className = "",
}: CharacterPortraitProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const isCatalog = portraitId ? isCatalogPortrait(portraitId) : false;
  const frameCss = portraitId && isCatalog ? portraitFrameCss(portraitId) : undefined;
  const externalSrc = portraitId && !isCatalog ? portraitId : undefined;
  const resolvedSrc = portraitId ? resolvePortraitSrc(portraitId) ?? externalSrc : undefined;

  const initials = characterName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "?";

  const onError = useCallback(() => setImgFailed(true), []);

  const showImage = !!resolvedSrc && !imgFailed;

  const borderRadius = shape === "circle" ? "50%" : "8px";

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius,
    fontSize: Math.max(10, Math.round(size * 0.32)),
  };

  return (
    <span
      className={`cportrait${showImage ? " has-image" : ""}${isCatalog ? " is-catalog" : ""}${decorative ? " is-decorative" : ""} ${className}`}
      style={style}
      role={decorative ? "presentation" : showImage ? "img" : undefined}
      aria-label={decorative ? undefined : showImage ? `${characterName} portrait` : undefined}
    >
      {showImage && frameCss ? (
        <span className="cportrait-art" style={frameCss} aria-hidden="true" />
      ) : showImage ? (
        <img
          src={resolvedSrc}
          alt={decorative ? "" : `${characterName} portrait`}
          onError={onError}
          width={size}
          height={size}
          loading="lazy"
        />
      ) : (
        <span className="cportrait-initials" aria-hidden={decorative ? undefined : !!showImage}>
          {initials}
        </span>
      )}
    </span>
  );
});
