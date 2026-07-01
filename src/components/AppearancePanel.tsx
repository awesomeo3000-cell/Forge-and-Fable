"use client";

import { memo, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CharacterTheme, ThemeBackgroundKey, ThemeFontKey } from "@/types/game";
import { BACKGROUND_LABELS, FONT_LABELS, FONT_STACKS, SKIN_PRESETS } from "@/lib/skins";

function contrastRatio(hex1: string, hex2: string) {
  const lum = (h: string) => {
    const r = parseInt(h.slice(1, 3), 16) / 255;
    const g = parseInt(h.slice(3, 5), 16) / 255;
    const b = parseInt(h.slice(5, 7), 16) / 255;
    const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };
  const l1 = lum(hex1);
  const l2 = lum(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const BACKGROUNDS: ThemeBackgroundKey[] = ["parchment", "plain", "linen", "stars", "sparkle", "forest", "dungeon"];

export default memo(function AppearancePanel(props: {
  theme: CharacterTheme | undefined;
  onUpdate: (theme: CharacterTheme | undefined) => void;
  onClose: () => void;
}) {
  const current = props.theme ?? SKIN_PRESETS[0].theme;
  const [paper, setPaper] = useState(current.paper);
  const [ink, setInk] = useState(current.ink);
  const [accent, setAccent] = useState(current.accent);
  const [fontKey, setFontKey] = useState<ThemeFontKey>(current.fontKey);
  const [bgKey, setBgKey] = useState<ThemeBackgroundKey>(current.backgroundKey);
  const [bgOpacity, setBgOpacity] = useState(current.backgroundOpacity ?? 0.5);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = (override?: Partial<CharacterTheme>) => {
    const data: CharacterTheme = {
      presetId: undefined,
      paper,
      ink,
      accent,
      fontKey,
      backgroundKey: bgKey,
      backgroundOpacity: bgOpacity,
      ...override,
    };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => props.onUpdate(data), 300);
  };

  const applyPreset = (presetId: string) => {
    const preset = SKIN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const t = preset.theme;
    setPaper(t.paper);
    setInk(t.ink);
    setAccent(t.accent);
    setFontKey(t.fontKey);
    setBgKey(t.backgroundKey);
    setBgOpacity(t.backgroundOpacity ?? 0.5);
    props.onUpdate({ ...t });
  };

  const ratio = contrastRatio(ink, paper);
  const warn = ratio < 4.5;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className="cs-skin-panel">
      <div className="cs-skin-head">
        <h3>Appearance</h3>
        <button type="button" className="cs-glass-btn" onClick={props.onClose}><X size={14} />Close</button>
      </div>

      <div className="cs-skin-section">
        <span className="cs-skin-label">Preset</span>
        <div className="cs-preset-grid">
          {SKIN_PRESETS.map((p) => (
            <button key={p.id} type="button" className="cs-preset-swatch" onClick={() => applyPreset(p.id)}
              style={{ background: p.theme.paper, color: p.theme.ink, fontFamily: FONT_STACKS[p.theme.fontKey] }}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="cs-skin-section">
        <span className="cs-skin-label">Colors</span>
        <div className="cs-color-row">
          <label className="cs-color-field">
            <span>Parchment</span>
            <input type="color" value={paper} onChange={(e) => { setPaper(e.target.value); save({ paper: e.target.value }); }} />
          </label>
          <label className="cs-color-field">
            <span>Ink</span>
            <input type="color" value={ink} onChange={(e) => { setInk(e.target.value); save({ ink: e.target.value }); }} />
          </label>
          <label className="cs-color-field">
            <span>Accent</span>
            <input type="color" value={accent} onChange={(e) => { setAccent(e.target.value); save({ accent: e.target.value }); }} />
          </label>
        </div>
        {warn ? <p className="cs-skin-warn">Low contrast — text may be hard to read</p> : null}
      </div>

      <div className="cs-skin-section">
        <span className="cs-skin-label">Font</span>
        <div className="cs-font-grid">
          {(Object.keys(FONT_STACKS) as ThemeFontKey[]).map((k) => (
            <button key={k} type="button" className={`cs-font-option${fontKey === k ? " active" : ""}`}
              style={{ fontFamily: FONT_STACKS[k] }}
              onClick={() => { setFontKey(k); save({ fontKey: k }); }}>
              {FONT_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="cs-skin-section">
        <span className="cs-skin-label">Background</span>
        <div className="cs-preset-grid cs-bg-grid">
          {BACKGROUNDS.map((k) => (
            <button key={k} type="button" className={`cs-bg-swatch${bgKey === k ? " active" : ""}`} data-bg={k} onClick={() => { setBgKey(k); save({ backgroundKey: k }); }}>
              <span>{BACKGROUND_LABELS[k]}</span>
            </button>
          ))}
        </div>
        <label className="cs-opacity-row">
          <span>Opacity</span>
          <input type="range" min="0.1" max="1" step="0.05" value={bgOpacity}
            onChange={(e) => { const v = Number(e.target.value); setBgOpacity(v); save({ backgroundOpacity: v }); }} />
          <span>{Math.round(bgOpacity * 100)}%</span>
        </label>
      </div>

      <button className="cs-skin-reset" type="button" onClick={() => { props.onUpdate(undefined); props.onClose(); }}>
        Reset to default
      </button>
    </div>
  );
})
