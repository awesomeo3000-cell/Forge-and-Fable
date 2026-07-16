"use client";

import { memo, useEffect, useState } from "react";
import { chapterArtworkForStep } from "@/lib/commissionChapterArtwork";

/**
 * Chapter banner (Arcane Storybook art handoff §6) — chapter copy on the
 * left, the chapter's storybook illustration on the right. Resolves artwork
 * through the central registry, hides the image on load failure (the panel
 * keeps its stable dark surface), and preloads the next chapter's banner so
 * forward navigation doesn't flash.
 */
export default memo(function CommissionChapterBanner(props: {
  step: number;
  eyebrow: string;
  title: string;
  intro: string;
}) {
  const artwork = chapterArtworkForStep(props.step);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    const next = chapterArtworkForStep(props.step + 1);
    if (next) {
      const img = new window.Image();
      img.src = next.bannerSrc;
    }
  }, [props.step]);

  const artFailed = artwork !== null && failedSrc === artwork.bannerSrc;

  return (
    <section className="ao-chapter-banner">
      <div className="ledger-chapter-head ao-chapter-head ao-chapter-banner-copy">
        <span className="ao-chapter-eyebrow">{props.eyebrow}</span>
        <h3 className="ledger-chapter-title ao-chapter-title" id="dj-section-title">
          {props.title}
        </h3>
        <p className="ledger-chapter-sub">{props.intro}</p>
      </div>
      {artwork ? (
        <div className="ao-chapter-banner-art">
          {!artFailed ? (
            <picture>
              <source media="(max-width: 760px)" srcSet={artwork.mobileBannerSrc} width={900} height={600} />
              <img
                src={artwork.bannerSrc}
                alt={artwork.alt}
                width={1920}
                height={720}
                loading="eager"
                style={{ objectPosition: artwork.objectPosition }}
                onError={() => {
                  if (process.env.NODE_ENV !== "production") {
                    console.warn(`[commission] chapter artwork failed to load: ${artwork.bannerSrc}`);
                  }
                  setFailedSrc(artwork.bannerSrc);
                }}
              />
            </picture>
          ) : null}
          <span className="ao-chapter-banner-chip">{artwork.label}</span>
        </div>
      ) : null}
    </section>
  );
});
