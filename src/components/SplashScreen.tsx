"use client";

import { Crown } from "lucide-react";

import { memo } from "react";

export default memo(function SplashScreen() {
  return (
    <main className="splash-screen">
      <div className="splash-mark">
        <Crown size={44} />
      </div>
      <div className="splash-copy">
        <span>Forge & Fable</span>
        <h1>Preparing the character vault</h1>
      </div>
      <div className="splash-progress">
        <span />
      </div>
    </main>
  );
})
