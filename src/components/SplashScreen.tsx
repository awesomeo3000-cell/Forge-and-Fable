"use client";

import { memo } from "react";

export default memo(function SplashScreen() {
  return (
    <main className="entry-screen ao-title-entry">
      <div className="ao-title-stack">
        <span className="ao-title-eyebrow">A Clarebear D&amp;D character builder</span>
        <h1 className="ao-title-wordmark">
          Forge
          <br />
          &amp; Fable
        </h1>
        <div className="ao-title-rule" aria-hidden="true">
          ✦
        </div>
        <div className="ao-title-loading" role="status">
          <div className="ao-title-progress">
            <span />
          </div>
          <span className="ao-title-loading-note">Preparing the character vault</span>
        </div>
      </div>
    </main>
  );
})
