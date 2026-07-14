import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Arcane Observatory — token showcase",
  robots: { index: false },
};

/**
 * Token showcase for the Arcane Observatory theme (plan Phase 1; CHANGES-AO-1).
 * Unlinked review surface: renders every semantic token so Gate 2 can judge
 * color, material and type balance in a real browser. No app state, no auth.
 * Phase 2 extends this page with the shared primitives.
 */

const SURFACES = [
  ["--surface-app", "app void"],
  ["--surface-shell", "shell / frame"],
  ["--surface-panel", "panel"],
  ["--surface-panel-raised", "panel raised"],
  ["--surface-panel-recessed", "panel recessed"],
  ["--surface-input", "input"],
  ["--surface-overlay", "overlay (opaque)"],
  ["--surface-document", "document"],
  ["--surface-document-muted", "document muted"],
];

const TEXTS = [
  ["--text-primary", "Primary text — warm white on dark surfaces"],
  ["--text-secondary", "Secondary text — supporting copy"],
  ["--text-muted", "Muted text — annotations, metadata"],
  ["--text-disabled", "Disabled text"],
];

const STATES = [
  ["--state-active", "--state-active-soft", "Acting now", "seal red"],
  ["--state-selected", "--state-selected-soft", "Selected", "arcane blue"],
  ["--state-success", "--state-success-soft", "Ready / success", "verdigris"],
  ["--state-warning", "--state-warning-soft", "Warning", "old gold"],
  ["--state-danger", "--state-danger-soft", "Danger", "dried red"],
];

const BORDERS = [
  ["--border-subtle", "subtle"],
  ["--border-default", "default"],
  ["--border-strong", "strong"],
  ["--border-brass", "brass"],
  ["--border-brass-bright", "brass bright"],
];

const SPACES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function Swatch({ token, label }: { token: string; label: string }) {
  return (
    <div className="ao-sc-swatch">
      <div className="ao-sc-swatch-chip" style={{ background: `var(${token})` }} />
      <div className="ao-sc-swatch-meta">
        <code>{token}</code>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function ThemeObservatoryPage() {
  return (
    <div data-theme="arcane-observatory" className="ao-sc-root">
      <header className="ao-sc-masthead">
        <p className="ao-sc-eyebrow">Forge &amp; Fable — internal review surface</p>
        <h1>Arcane Observatory tokens</h1>
        <p className="ao-sc-lede">
          Phase 1 semantic foundation. Every value below is a candidate until
          Gate 2 signs it off. Matte, engraved, scholarly — panels are opaque,
          borders do the separation, parchment appears only inside documents.
        </p>
      </header>

      <section className="ao-sc-section" aria-labelledby="sc-surfaces">
        <h2 id="sc-surfaces">Surfaces</h2>
        <div className="ao-sc-grid">
          {SURFACES.map(([t, l]) => (
            <Swatch key={t} token={t} label={l} />
          ))}
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-text">
        <h2 id="sc-text">Text roles</h2>
        <div className="ao-sc-panel">
          {TEXTS.map(([t, l]) => (
            <p key={t} style={{ color: `var(${t})` }}>
              <code>{t}</code> — {l}
            </p>
          ))}
        </div>
        <div className="ao-sc-document">
          <p style={{ color: "var(--text-document)" }}>
            <code>--text-document</code> — dark ink on a document surface. Long-form
            reading happens here: handouts, notes, the character sheet itself.
          </p>
          <p style={{ color: "var(--text-document-muted)" }}>
            <code>--text-document-muted</code> — marginalia and captions on paper.
          </p>
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-state">
        <h2 id="sc-state">State</h2>
        <div className="ao-sc-grid">
          {STATES.map(([solid, soft, name, nickname]) => (
            <div key={solid} className="ao-sc-state" style={{ background: `var(${soft})` }}>
              <span className="ao-sc-state-chip" style={{ background: `var(${solid})` }} />
              <div className="ao-sc-swatch-meta">
                <strong>{name}</strong>
                <code>{solid}</code>
                <span>{nickname}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-borders">
        <h2 id="sc-borders">Borders, rules, depth</h2>
        <div className="ao-sc-grid">
          {BORDERS.map(([t, l]) => (
            <div key={t} className="ao-sc-borderbox" style={{ borderColor: `var(${t})` }}>
              <code>{t}</code>
              <span>{l}</span>
            </div>
          ))}
        </div>
        <div className="ao-sc-rule-demo">
          <p>Engraved rule — a dark cut with a light return:</p>
          <hr className="ao-sc-engraved" />
        </div>
        <div className="ao-sc-depth-row">
          <div className="ao-sc-depth" style={{ boxShadow: "var(--shadow-panel)" }}>panel shadow</div>
          <div className="ao-sc-depth" style={{ boxShadow: "var(--shadow-overlay)" }}>overlay shadow</div>
          <div className="ao-sc-depth ao-sc-depth-recessed" style={{ boxShadow: "var(--inset-recessed)" }}>recessed</div>
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-geometry">
        <h2 id="sc-geometry">Geometry and spacing</h2>
        <div className="ao-sc-depth-row">
          {(["xs", "sm", "md"] as const).map((r) => (
            <div key={r} className="ao-sc-radius" style={{ borderRadius: `var(--radius-${r})` }}>
              <code>--radius-{r}</code>
            </div>
          ))}
        </div>
        <div className="ao-sc-spacing">
          {SPACES.map((s) => (
            <div key={s} className="ao-sc-space-row">
              <code>--space-{s}</code>
              <span style={{ width: `var(--space-${s})` }} />
            </div>
          ))}
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-type">
        <h2 id="sc-type">Typography roles</h2>
        <div className="ao-sc-panel ao-sc-typestack">
          <p style={{ font: "600 2.2rem/1.15 var(--font-role-display)" }}>Display — The Observatory Opens</p>
          <p style={{ font: "600 1.35rem/1.25 var(--font-role-section)" }}>Section — Initiative order</p>
          <p
            style={{
              font: "600 0.72rem/1.3 var(--font-role-label)",
              letterSpacing: "var(--label-tracking)",
              textTransform: "uppercase",
            }}
          >
            Label — Hit points · Armor class · Reaction
          </p>
          <p style={{ font: "400 1rem/1.55 var(--font-role-body)" }}>
            Body — The tower&apos;s upper ring holds the orrery; its lower vault holds
            everything the order would rather forget. Readable at game-table distance.
          </p>
          <p style={{ font: "400 1.5rem/1.2 var(--font-role-numeric)" }}>Numeric — 17 · +3 · 21/28 · d20</p>
        </div>
      </section>

      <footer className="ao-sc-footer">
        <p>
          CHANGES-AO-1 · tokens only, nothing here is wired into the app shell ·
          values final at Gate 2
        </p>
      </footer>
    </div>
  );
}
