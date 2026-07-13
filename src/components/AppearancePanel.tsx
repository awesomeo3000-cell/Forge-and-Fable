"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import PortraitField from "@/components/PortraitField";
import CharacterPortrait from "@/components/portraits/CharacterPortrait";
import type { CharacterTheme, ThemeBackgroundKey, ThemeFontKey } from "@/types/game";
import { BACKGROUND_LABELS, FONT_LABELS, FONT_STACKS, SKIN_PRESETS, loadUserPresets, saveUserPreset, deleteUserPreset, encodeSkinCode, decodeSkinCode, isValidBackgroundImageUrl } from "@/lib/skins";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { isCatalogPortrait } from "@/data/portraits";

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

function normalizeHex(raw: string, fallback: string): string {
  let h = raw.trim();
  if (!h.startsWith("#")) h = "#" + h;
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  return fallback;
}

function isValidPortraitUrl(value: string) {
  return value === "" || isCatalogPortrait(value) || /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value);
}

const BACKGROUNDS: ThemeBackgroundKey[] = ["parchment", "plain", "linen", "stars", "sparkle", "forest", "dungeon"];

function userIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("forge-and-fable-user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: string };
    return u.id ?? null;
  } catch { return null; }
}

export default memo(function AppearancePanel(props: {
  theme: CharacterTheme | undefined;
  onUpdate: (theme: CharacterTheme | undefined) => void;
  portraitUrl?: string;
  onPortraitUpdate?: (portraitUrl: string) => void;
  onClose: () => void;
}) {
  const current = props.theme ?? SKIN_PRESETS[0].theme;
  const [paper, setPaper] = useState(current.paper);
  const [ink, setInk] = useState(current.ink);
  const [accent, setAccent] = useState(current.accent);
  const [fontKey, setFontKey] = useState<ThemeFontKey>(current.fontKey);
  const [bgKey, setBgKey] = useState<ThemeBackgroundKey>(current.backgroundKey);
  const [bgOpacity, setBgOpacity] = useState(current.backgroundOpacity ?? 0.5);
  const [paperHex, setPaperHex] = useState(current.paper);
  const [inkHex, setInkHex] = useState(current.ink);
  const [accentHex, setAccentHex] = useState(current.accent);
  const [fontScale, setFontScale] = useState(current.fontScale ?? 1);
  const [bgUrl, setBgUrl] = useState(current.backgroundImageUrl ?? "");
  const [portraitUrl, setPortraitUrl] = useState(props.portraitUrl ?? "");
  const [importCode, setImportCode] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [presetName, setPresetName] = useState("");
  const [userPresets, setUserPresets] = useState<{ id: string; name: string; theme: CharacterTheme }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef<CharacterTheme | undefined>(props.theme);
  const portraitSnapshotRef = useRef(props.portraitUrl ?? "");
  const portraitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load user presets on mount
  useEffect(() => {
    const uid = userIdFromStorage();
    if (uid) setUserPresets(loadUserPresets(uid));
  }, []);

  const save = useCallback((override?: Partial<CharacterTheme>) => {
    const data: CharacterTheme = {
      presetId: undefined,
      paper,
      ink,
      accent,
      fontKey,
      backgroundKey: bgKey,
      backgroundOpacity: bgOpacity,
      fontScale: fontScale !== 1 ? fontScale : undefined,
      backgroundImageUrl: isValidBackgroundImageUrl(bgUrl) ? bgUrl : undefined,
      ...override,
    };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => props.onUpdate(data), 300);
  }, [paper, ink, accent, fontKey, bgKey, bgOpacity, fontScale, bgUrl, props]);

  const applyPreset = useCallback((theme: CharacterTheme) => {
    setPaper(theme.paper);
    setInk(theme.ink);
    setAccent(theme.accent);
    setFontKey(theme.fontKey);
    setBgKey(theme.backgroundKey);
    setBgOpacity(theme.backgroundOpacity ?? 0.5);
    setPaperHex(theme.paper);
    setInkHex(theme.ink);
    setAccentHex(theme.accent);
    setFontScale(theme.fontScale ?? 1);
    setBgUrl(theme.backgroundImageUrl ?? "");
    if (timer.current) clearTimeout(timer.current);
    props.onUpdate({ ...theme });
  }, [props]);

  const handleApplyPreset = (presetId: string) => {
    // Check built-ins first, then user presets
    const builtin = SKIN_PRESETS.find((p) => p.id === presetId);
    if (builtin) { applyPreset(builtin.theme); return; }
    const user = userPresets.find((p) => p.id === presetId);
    if (user) applyPreset(user.theme);
  };

  const handleSavePreset = () => {
    const uid = userIdFromStorage();
    if (!uid || !presetName.trim()) return;
    const theme: CharacterTheme = {
      presetId: undefined,
      paper,
      ink,
      accent,
      fontKey,
      backgroundKey: bgKey,
      backgroundOpacity: bgOpacity,
      fontScale: fontScale !== 1 ? fontScale : undefined,
      backgroundImageUrl: isValidBackgroundImageUrl(bgUrl) ? bgUrl : undefined,
    };
    const updated = saveUserPreset(uid, presetName, theme);
    setUserPresets(updated);
    setPresetName("");
  };

  const handleDeletePreset = (id: string) => {
    if (!window.confirm("Delete this preset?")) return;
    const uid = userIdFromStorage();
    if (!uid) return;
    const updated = deleteUserPreset(uid, id);
    setUserPresets(updated);
  };

  const handleRevert = () => {
    const snap = snapshotRef.current;
    if (timer.current) clearTimeout(timer.current);
    if (portraitTimer.current) clearTimeout(portraitTimer.current);
    setPortraitUrl(portraitSnapshotRef.current);
    props.onPortraitUpdate?.(portraitSnapshotRef.current);
    if (snap) {
      applyPreset(snap);
    } else {
      // No theme when opened — reset to default
      props.onUpdate(undefined);
      props.onClose();
    }
  };

  const handleHex = (hex: string, setColor: (v: string) => void, setHex: (v: string) => void, field: keyof CharacterTheme) => {
    setHex(hex);
    const normalized = normalizeHex(hex, "");
    if (normalized) {
      setColor(normalized);
      save({ [field]: normalized } as Partial<CharacterTheme>);
    }
  };

  const handleCopyCode = async () => {
    const code = encodeSkinCode({
      paper, ink, accent, fontKey,
      backgroundKey: bgKey, backgroundOpacity: bgOpacity,
      fontScale: fontScale !== 1 ? fontScale : undefined,
      backgroundImageUrl: isValidBackgroundImageUrl(bgUrl) ? bgUrl : undefined,
    });
    try {
      await navigator.clipboard.writeText(code);
      setShareStatus("Skin code copied to clipboard");
    } catch {
      setShareStatus(code); // clipboard blocked — show the code for manual copy
    }
  };

  const handleImportCode = () => {
    const theme = decodeSkinCode(importCode);
    if (!theme) {
      setShareStatus("That skin code could not be read");
      return;
    }
    applyPreset(theme);
    setImportCode("");
    setShareStatus("Skin applied");
  };

  const bgUrlInvalid = bgUrl.trim() !== "" && !isValidBackgroundImageUrl(bgUrl.trim());
  const portraitUrlInvalid = !isValidPortraitUrl(portraitUrl.trim());

  const inkPaperRatio = contrastRatio(ink, paper);
  const accentPaperRatio = contrastRatio(accent, paper);
  const inkWarn = inkPaperRatio < 4.5;
  const accentWarn = accentPaperRatio < 3.0;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (portraitTimer.current) clearTimeout(portraitTimer.current); }, []);

  const updatePortrait = (value: string) => {
    setPortraitUrl(value);
    const trimmed = value.trim();
    if (!isValidPortraitUrl(trimmed)) return;
    if (portraitTimer.current) clearTimeout(portraitTimer.current);
    portraitTimer.current = setTimeout(() => props.onPortraitUpdate?.(trimmed), 300);
  };

  // Sync hex fields when color pickers change externally
  useEffect(() => { setPaperHex(paper); }, [paper]);
  useEffect(() => { setInkHex(ink); }, [ink]);
  useEffect(() => { setAccentHex(accent); }, [accent]);

  const allPresets = [...SKIN_PRESETS, ...userPresets];

  const panelRef = useFocusTrap(true);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onClose();
        queueMicrotask(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
      queueMicrotask(() => triggerRef.current?.focus());
    };
  }, [props]);

  return (
    <div className="cs-skin-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Appearance settings">
      <div className="cs-skin-head">
        <h3>Appearance</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="cs-glass-btn" onClick={handleRevert} title="Revert to how this looked when opened"><RotateCcw size={14} />Revert</button>
          <button type="button" className="cs-glass-btn" onClick={props.onClose}><X size={14} />Close</button>
        </div>
      </div>

      <div className="cs-skin-section">
        <span className="cs-skin-label">Preset</span>
        <div className="cs-preset-grid">
          {allPresets.map((p) => (
            <button key={p.id} type="button" className="cs-preset-swatch" onClick={() => handleApplyPreset(p.id)}
              style={{ background: p.theme.paper, color: p.theme.ink, fontFamily: FONT_STACKS[p.theme.fontKey] }}>
              <span className="cs-preset-accent-bar" style={{ background: p.theme.accent }} />
              <span className="cs-preset-name">{p.name}</span>
              <span className="cs-preset-stat" style={{ color: p.theme.accent }}>+3</span>
              {userPresets.some((u) => u.id === p.id) ? (
                <button type="button" className="cs-preset-del" title="Delete preset" aria-label={`Delete preset ${p.name}`} onClick={(e) => { e.stopPropagation(); handleDeletePreset(p.id); }}>×</button>
              ) : null}
            </button>
          ))}
        </div>
        <div className="cs-preset-save-row">
          <input type="text" className="qb-name-input" placeholder="Preset name..." value={presetName}
            onChange={(e) => setPresetName(e.target.value)} maxLength={50} />
          <button type="button" className="cs-glass-btn" disabled={!presetName.trim()} onClick={handleSavePreset}>
            Save as preset
          </button>
        </div>
        {userPresets.length === 0 ? <p className="cs-muted" style={{ marginTop: 4, fontSize: "0.78rem" }}>No saved themes yet</p> : null}
      </div>

      <div className="cs-skin-section">
        <span className="cs-skin-label">Colors</span>
        <div className="cs-color-row">
          <label className="cs-color-field">
            <span>Parchment</span>
            <input type="color" value={paper} onChange={(e) => { setPaper(e.target.value); save({ paper: e.target.value }); }} />
            <input type="text" className="cs-hex-input" value={paperHex}
              onChange={(e) => handleHex(e.target.value, setPaper, setPaperHex, "paper")}
              onBlur={() => setPaperHex(paper)} maxLength={7} />
          </label>
          <label className="cs-color-field">
            <span>Ink</span>
            <input type="color" value={ink} onChange={(e) => { setInk(e.target.value); save({ ink: e.target.value }); }} />
            <input type="text" className="cs-hex-input" value={inkHex}
              onChange={(e) => handleHex(e.target.value, setInk, setInkHex, "ink")}
              onBlur={() => setInkHex(ink)} maxLength={7} />
          </label>
          <label className="cs-color-field">
            <span>Accent</span>
            <input type="color" value={accent} onChange={(e) => { setAccent(e.target.value); save({ accent: e.target.value }); }} />
            <input type="text" className="cs-hex-input" value={accentHex}
              onChange={(e) => handleHex(e.target.value, setAccent, setAccentHex, "accent")}
              onBlur={() => setAccentHex(accent)} maxLength={7} />
          </label>
        </div>
        {inkWarn ? <p className="cs-skin-warn">Low contrast — text may be hard to read</p> : null}
        {accentWarn ? <p className="cs-skin-warn">Accent has low contrast against the parchment — small labels may be hard to read</p> : null}
      </div>

      <div className="cs-skin-section">
        <span className="cs-skin-label">Character portrait</span>
        <div className="cs-portrait-setting">
          <CharacterPortrait
            portraitId={portraitUrl || null}
            characterName="Character"
            size={58}
            shape="circle"
            decorative
            className="cs-portrait-preview"
          />
          <div>
            <input type="text" className="qb-name-input" aria-label="Character portrait URL" placeholder="Portrait URL (https://...)" value={portraitUrl} onChange={(event) => updatePortrait(event.target.value)} maxLength={500} />
            <p className="cs-muted">Used in campaign and DM party views. Class artwork remains the fallback.</p>
          </div>
          {portraitUrl ? <button type="button" className="cs-glass-btn" onClick={() => updatePortrait("")}>Clear</button> : null}
        </div>
        <PortraitField
          value={portraitUrl}
          characterName="Character"
          onChange={(url) => updatePortrait(url)}
        />
        {portraitUrlInvalid ? <p className="cs-skin-warn">Enter a full http(s) image link or a site-relative image path.</p> : null}
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
        <label className="cs-opacity-row">
          <span>Text size</span>
          <input type="range" min="0.85" max="1.25" step="0.05" value={fontScale}
            onChange={(e) => { const v = Number(e.target.value); setFontScale(v); save({ fontScale: v !== 1 ? v : undefined }); }} />
          <span>{Math.round(fontScale * 100)}%</span>
        </label>
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
        <div className="cs-bgurl-row">
          <input type="text" className="qb-name-input" placeholder="Image URL (https://...) — overrides texture" value={bgUrl}
            onChange={(e) => { const v = e.target.value; setBgUrl(v); const trimmed = v.trim(); if (trimmed === "") { save({ backgroundImageUrl: undefined }); } else if (isValidBackgroundImageUrl(trimmed)) { save({ backgroundImageUrl: trimmed }); } }}
            maxLength={500} />
          {bgUrl ? <button type="button" className="cs-glass-btn" onClick={() => { setBgUrl(""); save({ backgroundImageUrl: undefined }); }}>Clear</button> : null}
        </div>
        {bgUrlInvalid ? <p className="cs-skin-warn">Enter a full https:// image link (max 500 characters)</p> : null}
      </div>

      <div className="cs-skin-section">
        <span className="cs-skin-label">Share</span>
        <div className="cs-share-row">
          <button type="button" className="cs-glass-btn" onClick={handleCopyCode}>Copy skin code</button>
          <input type="text" className="qb-name-input" placeholder="Paste a skin code..." value={importCode}
            onChange={(e) => setImportCode(e.target.value)} />
          <button type="button" className="cs-glass-btn" disabled={!importCode.trim()} onClick={handleImportCode}>Apply</button>
        </div>
        {shareStatus ? <p className="cs-share-status">{shareStatus}</p> : null}
      </div>

      <button className="cs-skin-reset" type="button" onClick={() => { if (timer.current) clearTimeout(timer.current); props.onUpdate(undefined); props.onClose(); }}>
        Reset to default
      </button>
    </div>
  );
})
