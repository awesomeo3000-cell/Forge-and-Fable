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

      <section className="ao-sc-section" aria-labelledby="sc-buttons">
        <h2 id="sc-buttons">Primitives — buttons</h2>
        <div className="ao-sc-panel">
          <div className="ao-sc-cluster">
            <button className="ao-btn ao-btn-primary">Next turn</button>
            <button className="ao-btn ao-btn-brass">Open the table</button>
            <button className="ao-btn">Short rest</button>
            <button className="ao-btn ao-btn-quiet">Cancel</button>
            <button className="ao-btn ao-btn-danger">End encounter</button>
            <button className="ao-btn ao-btn-icon" aria-label="Roll dice">⚄</button>
            <button className="ao-btn" disabled>Disabled</button>
            <button className="ao-btn ao-btn-primary" disabled>Disabled primary</button>
          </div>
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-fields">
        <h2 id="sc-fields">Primitives — fields</h2>
        <div className="ao-sc-panel ao-sc-fieldgrid">
          <div className="ao-field">
            <label htmlFor="sc-name">Character name</label>
            <input id="sc-name" className="ao-input" placeholder="Isolde Vance" />
          </div>
          <div className="ao-field">
            <label htmlFor="sc-class">Class</label>
            <select id="sc-class" className="ao-select" defaultValue="wizard">
              <option value="wizard">Wizard</option>
              <option value="rogue">Rogue</option>
            </select>
          </div>
          <div className="ao-field">
            <label htmlFor="sc-bad">Level (error state)</label>
            <input id="sc-bad" className="ao-input" aria-invalid="true" defaultValue="23" aria-describedby="sc-bad-msg" />
            <p id="sc-bad-msg" className="ao-field-error">Level must be between 1 and 20.</p>
          </div>
          <div className="ao-field">
            <label htmlFor="sc-off">Disabled</label>
            <input id="sc-off" className="ao-input" disabled value="Sealed by the DM" readOnly />
          </div>
          <div className="ao-field ao-sc-span2">
            <label htmlFor="sc-notes">Notes</label>
            <textarea id="sc-notes" className="ao-textarea" rows={2} placeholder="The orrery turned once, then stopped…" />
          </div>
          <label className="ao-checkline"><input type="checkbox" defaultChecked /> Concentration held</label>
          <label className="ao-checkline"><input type="radio" name="sc-adv" defaultChecked /> Advantage</label>
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-nav">
        <h2 id="sc-nav">Primitives — segmented control and tabs</h2>
        <div className="ao-sc-panel">
          <div className="ao-sc-cluster">
            <div className="ao-segmented" role="group" aria-label="Workspace mode">
              <button aria-pressed="true">Encounter</button>
              <button aria-pressed="false">Party</button>
              <button aria-pressed="false">Tools</button>
            </div>
          </div>
          <div className="ao-tabs" role="tablist" aria-label="Sheet sections">
            <button className="ao-tab" role="tab" aria-selected="true">Attacks</button>
            <button className="ao-tab" role="tab" aria-selected="false">Spells</button>
            <button className="ao-tab" role="tab" aria-selected="false">Inventory</button>
            <button className="ao-tab" role="tab" aria-selected="false">Notes</button>
          </div>
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-chips">
        <h2 id="sc-chips">Primitives — chips and banners</h2>
        <div className="ao-sc-panel">
          <div className="ao-sc-cluster">
            <span className="ao-chip">Neutral</span>
            <span className="ao-chip" data-tone="active">Acting now</span>
            <span className="ao-chip" data-tone="selected">Selected</span>
            <span className="ao-chip" data-tone="success">Ready</span>
            <span className="ao-chip" data-tone="warning">Concentrating</span>
            <span className="ao-chip" data-tone="danger">Poisoned</span>
          </div>
          <div className="ao-sc-stack">
            <div className="ao-banner">A quiet note — the session resumes at the vault door.</div>
            <div className="ao-banner" data-tone="success">Long rest complete. Resources restored.</div>
            <div className="ao-banner" data-tone="warning">Two players have not answered the roll request.</div>
            <div className="ao-banner" data-tone="danger">Merric is dying — two failed death saves.</div>
          </div>
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-stats">
        <h2 id="sc-stats">Primitives — stats, meters, tokens</h2>
        <div className="ao-sc-panel">
          <div className="ao-sc-cluster">
            <div className="ao-stat"><span>Armor class</span><strong>15</strong></div>
            <div className="ao-stat"><span>Initiative</span><strong>+3</strong></div>
            <div className="ao-stat"><span>Speed</span><strong>30 ft</strong></div>
            <div className="ao-stat"><span>Prof</span><strong>+3</strong></div>
            <span className="ao-token-disc">IV</span>
            <span className="ao-token-disc">MU</span>
            <span className="ao-index-badge">2</span>
            <span className="ao-index-badge">11</span>
          </div>
          <div className="ao-sc-stack" style={{ maxWidth: 380 }}>
            <div className="ao-meter" role="meter" aria-label="Hit points" aria-valuenow={21} aria-valuemin={0} aria-valuemax={28}>
              <span style={{ width: "75%" }} />
            </div>
            <div className="ao-meter" data-tone="hp-low" role="meter" aria-label="Hit points low" aria-valuenow={4} aria-valuemin={0} aria-valuemax={28}>
              <span style={{ width: "14%" }} />
            </div>
            <div className="ao-meter" data-tone="resource" role="meter" aria-label="Spell slots" aria-valuenow={3} aria-valuemin={0} aria-valuemax={4}>
              <span style={{ width: "60%" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-stategrammar">
        <h2 id="sc-stategrammar">State grammar — acting, selected, combined</h2>
        <div className="ao-sc-panel ao-sc-stack">
          <div className="ao-row" data-state="acting">
            <span className="ao-marker" data-state="acting" aria-hidden="true" />
            <span className="ao-token-disc">GR</span>
            <strong>Grask the Render</strong>
            <span className="ao-acting-label">Acting now</span>
            <span className="ao-chip" data-tone="danger">Bloodied</span>
          </div>
          <div className="ao-row" data-state="selected">
            <span className="ao-marker" data-state="selected" aria-hidden="true" />
            <span className="ao-token-disc">IV</span>
            <strong>Isolde Vance</strong>
            <span className="ao-chip" data-tone="selected">Selected</span>
          </div>
          <div className="ao-row" data-state="acting" aria-label="Selected and acting — acting styling wins">
            <span className="ao-marker" data-state="acting" aria-hidden="true" />
            <span className="ao-token-disc">MU</span>
            <strong>Merric Underbough</strong>
            <span className="ao-acting-label">Acting now</span>
            <span className="ao-chip" data-tone="selected">Selected</span>
          </div>
          <div className="ao-row">
            <span className="ao-marker" aria-hidden="true" />
            <span className="ao-index-badge">3</span>
            <span>Skeleton</span>
            <span className="ao-chip">Waiting</span>
          </div>
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-log">
        <h2 id="sc-log">Primitives — event log and empty state</h2>
        <div className="ao-sc-panel">
          <ul className="ao-log">
            <li data-tone="critical"><time>21:42</time><span>Grask crits Merric for 19 slashing — Merric falls.</span></li>
            <li><time>21:41</time><span>Isolde casts Shield; attack misses.</span></li>
            <li data-tone="announce"><time>21:40</time><span>The DM whispers something to the wizard.</span></li>
            <li><time>21:39</time><span>Round 3 begins.</span></li>
          </ul>
        </div>
        <div className="ao-empty" style={{ marginTop: "var(--space-4)" }}>
          <strong>No encounter running</strong>
          <span>Seat the party and roll initiative to open the table.</span>
          <button className="ao-btn ao-btn-primary" style={{ marginTop: "var(--space-2)" }}>Roll initiative</button>
        </div>
      </section>

      <section className="ao-sc-section" aria-labelledby="sc-doc">
        <h2 id="sc-doc">Document surface and modal shell</h2>
        <div className="ao-sc-splitrow">
          <div className="ao-document" style={{ padding: "var(--space-5)" }}>
            <p style={{ margin: 0, fontStyle: "italic" }}>
              &ldquo;The eighth lens is not missing. It was ground into the mortar of the
              observatory&rsquo;s foundation, and it is still watching.&rdquo;
            </p>
            <p style={{ margin: "var(--space-3) 0 0", color: "var(--text-document-muted)", fontSize: "0.85rem" }}>
              — recovered handout, session four
            </p>
          </div>
          <div className="ao-modal" style={{ padding: "var(--space-5)" }} role="dialog" aria-label="Example dialog">
            <div className="ao-panel-header"><h3>Withdraw request?</h3></div>
            <p style={{ margin: "0 0 var(--space-4)", color: "var(--text-secondary)", fontSize: "0.92rem" }}>
              The open roll request will be closed for all players.
            </p>
            <div className="ao-sc-cluster">
              <button className="ao-btn ao-btn-danger">Withdraw</button>
              <button className="ao-btn ao-btn-quiet">Keep waiting</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="ao-sc-footer">
        <p>
          CHANGES-AO-1 tokens + CHANGES-AO-2 primitives · nothing here is wired
          into the app shell · values final at Gate 2
        </p>
      </footer>
    </div>
  );
}
