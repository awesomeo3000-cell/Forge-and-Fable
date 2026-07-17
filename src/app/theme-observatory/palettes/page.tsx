import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Arcane Observatory — accent palette options",
  robots: { index: false },
};

/**
 * Gate 2 follow-up (owner request 2026-07-14): arcane blue is approved,
 * brass is not yet. Ten candidate accent palettes, each driving the SAME
 * mini interface through the `--border-brass(-bright)` hooks the Phase 2
 * primitives already read. Surfaces, arcane blue and seal red stay fixed
 * in every card so only the accent is being judged.
 */

type PaletteOption = {
  id: string;
  name: string;
  base: string;
  bright: string;
  note: string;
};

const OPTIONS: PaletteOption[] = [
  {
    id: "brass",
    name: "1 · Antique brass",
    base: "#9e8452",
    bright: "#c0a86f",
    note: "The incumbent from the prototype — warm, muted, instrument-like.",
  },
  {
    id: "old-gold",
    name: "2 · Old gold",
    base: "#b3924a",
    bright: "#d9b967",
    note: "Richer and more saturated than brass; reads as treasure and gilt edges.",
  },
  {
    id: "copper",
    name: "3 · Aged copper",
    base: "#a56f4e",
    bright: "#c9906c",
    note: "Warmest option — candlelight against the ink blue, kin to the seal red.",
  },
  {
    id: "rose-gold",
    name: "4 · Rose gold",
    base: "#b28577",
    bright: "#d3a794",
    note: "Soft and unusual; gentler than copper, less martial than gold.",
  },
  {
    id: "bronze",
    name: "5 · Weathered bronze",
    base: "#8a7f4f",
    bright: "#a99e6b",
    note: "Olive-tinged field bronze — the quietest of the warm metals.",
  },
  {
    id: "verdigris",
    name: "6 · Verdigris",
    base: "#62a08c",
    bright: "#8cc2ad",
    note: "Oxidized copper green. Caution: sits close to the success state color.",
  },
  {
    id: "patina",
    name: "7 · Teal patina",
    base: "#63a0a8",
    bright: "#8ac3ca",
    note: "Descendant of the prototype's original cyan, matte-ified.",
  },
  {
    id: "pewter",
    name: "8 · Pewter",
    base: "#8ea0af",
    bright: "#b3c6d4",
    note: "Quiet steel. Near-monochrome scholar's kit; lets red and blue do the talking.",
  },
  {
    id: "silver",
    name: "9 · Moon silver",
    base: "#aab6c6",
    bright: "#d3dde9",
    note: "Brightest metal — strong structure lines, engraved-starlight feel.",
  },
  {
    id: "violet",
    name: "10 · Arcane violet",
    base: "#8d7fc0",
    bright: "#ac9dd9",
    note: "The mystic option; analogous to the blue, so selection needs the shape cues.",
  },
];

function Sample({ opt }: { opt: PaletteOption }) {
  const vars = {
    "--border-brass": opt.base,
    "--border-brass-bright": opt.bright,
  } as CSSProperties;
  return (
    <article className="ao-panel ao-pal-card" style={vars}>
      <header className="ao-pal-head">
        <div>
          <h2>{opt.name}</h2>
          <p className="ao-pal-hexes">
            <code>{opt.base}</code> · <code>{opt.bright}</code>
          </p>
        </div>
        <span className="ao-pal-chipset" aria-hidden="true">
          <i style={{ background: opt.base }} />
          <i style={{ background: opt.bright }} />
          <i style={{ background: "var(--state-selected)" }} />
          <i style={{ background: "var(--state-active)" }} />
        </span>
      </header>

      <div className="ao-pal-navdemo">
        <span className="ao-pal-navitem" data-active="true">
          <span className="ao-eyebrow">Encounter</span>
        </span>
        <span className="ao-pal-navitem">
          <span>Party</span>
        </span>
        <span className="ao-pal-navitem">
          <span>Chronicle</span>
        </span>
      </div>

      <div className="ao-tabs" role="presentation">
        <span className="ao-tab" aria-selected="true">Attacks</span>
        <span className="ao-tab" aria-selected="false">Spells</span>
        <span className="ao-tab" aria-selected="false">Inventory</span>
      </div>

      <div className="ao-pal-buttons">
        <span className="ao-btn ao-btn-brass">Open the table</span>
        <span className="ao-btn ao-btn-primary">Next turn</span>
        <span className="ao-btn">Short rest</span>
      </div>

      <div className="ao-pal-staterow">
        <span className="ao-chip" data-tone="active">Acting now</span>
        <span className="ao-chip" data-tone="selected">Selected</span>
        <span className="ao-eyebrow">Initiative · Round 3</span>
      </div>

      <hr className="ao-rule-brass" />
      <p className="ao-pal-note">{opt.note}</p>
    </article>
  );
}

export default function PaletteOptionsPage(): ReactNode {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_INTERNAL_REVIEW_ROUTES !== "true") {
    notFound();
  }
  return (
    <div data-theme="arcane-observatory" className="ao-sc-root">
      <header className="ao-sc-masthead">
        <p className="ao-sc-eyebrow">{BRAND_NAME} — internal review surface</p>
        <h1>Accent options beside the arcane blue</h1>
        <p className="ao-sc-lede">
          Surfaces, arcane-blue selection and seal-red action are FIXED in
          every card; only the structural accent (eyebrows, active markers,
          tab underline, accent button, rules) changes. Judge each card by:
          does the accent hold its own next to blue and red without shouting?
        </p>
      </header>

      <div className="ao-pal-grid">
        {OPTIONS.map((opt) => (
          <Sample key={opt.id} opt={opt} />
        ))}
      </div>

      <footer className="ao-sc-footer">
        <p>
          Gate 2 follow-up · pick one (or ask for turns on a favorite) ·
          the winner becomes --border-brass in CHANGES-AO-1&apos;s token block,
          renamed to --border-metal if it stops being brass
        </p>
      </footer>
    </div>
  );
}
