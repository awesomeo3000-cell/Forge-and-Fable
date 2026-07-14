"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, CircleUser, Link, Upload } from "lucide-react";
import { PORTRAITS, portraitFrameCss } from "@/data/portraits";
import { useFocusTrap } from "@/lib/useFocusTrap";
import CharacterPortrait from "@/components/portraits/CharacterPortrait";
import type { PortraitOption } from "@/data/portraits";

type Props = {
  open: boolean;
  /** Current saved portrait ID (opaque catalog ID or external URL). */
  value?: string | null;
  /** Ancestry key used to pre-filter the Suggested tab. */
  suggestedAncestry?: string;
  characterName: string;
  onSave: (portraitId: string) => void;
  onClose: () => void;
};

type TabId = "suggested" | "all";

function isValidImageLink(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value);
}

/* Client-side mirror of the /api/portraits limits — the server re-validates. */
const UPLOAD_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;

/**
 * Modal portrait selector: scene backdrop, image-only tiles, a labeled
 * selection column, and an in-modal image-link fallback. Never exposes
 * ancestry or presentation metadata to the player.
 */
export default memo(function PortraitSelectorModal({
  open,
  value,
  suggestedAncestry,
  characterName,
  onSave,
  onClose,
}: Props) {
  // Temporary selection — separate from the saved value until Save.
  const [pendingId, setPendingId] = useState<string | null>(value ?? null);
  const [tab, setTab] = useState<TabId>(suggestedAncestry ? "suggested" : "all");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useFocusTrap(open);

  // Reset pending state when modal opens.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setPendingId(value ?? null);
      setTab(suggestedAncestry ? "suggested" : "all");
      setLinkOpen(false);
      setLinkDraft("");
      setUploading(false);
      setUploadError(null);
    }
  }, [open, value, suggestedAncestry]);

  const handleUpload = useCallback(async (file: File) => {
    setUploadError(null);
    if (!UPLOAD_MIME_TYPES.has(file.type)) {
      setUploadError("Only PNG, JPEG, WebP, or GIF images are accepted.");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      setUploadError(`Image too large (max ${MAX_UPLOAD_SIZE / 1024 / 1024} MB).`);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/portraits", { method: "POST", body: formData });
      const data = (await response.json()) as { portraitUrl?: string; error?: string };
      if (!response.ok || !data.portraitUrl) {
        setUploadError(data.error ?? "The upload failed. Try again.");
        return;
      }
      setPendingId(data.portraitUrl);
    } catch {
      setUploadError("The upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  // Escape → Cancel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        queueMicrotask(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      queueMicrotask(() => triggerRef.current?.focus());
    };
  }, [open, onClose]);

  const handleSave = useCallback(() => {
    if (pendingId) {
      onSave(pendingId);
    }
    onClose();
    queueMicrotask(() => triggerRef.current?.focus());
  }, [pendingId, onSave, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
    queueMicrotask(() => triggerRef.current?.focus());
  }, [onClose]);

  const applyLink = useCallback(() => {
    const trimmed = linkDraft.trim();
    if (!trimmed || !isValidImageLink(trimmed)) return;
    setPendingId(trimmed);
  }, [linkDraft]);

  const suggestedPortraits = useMemo(() => {
    if (!suggestedAncestry) return PORTRAITS;
    return PORTRAITS.filter((p) => p.suggestedAncestries.includes(suggestedAncestry));
  }, [suggestedAncestry]);

  const hasSuggestions = !!suggestedAncestry && suggestedPortraits.length > 0;
  const displayPortraits: readonly PortraitOption[] =
    tab === "suggested" && hasSuggestions ? suggestedPortraits : PORTRAITS;

  const linkInvalid = linkDraft.trim() !== "" && !isValidImageLink(linkDraft.trim());

  if (!open) return null;

  return (
    <div className="portrait-modal-overlay">
      <div
        ref={panelRef}
        className="portrait-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portrait-modal-title"
      >
        {/* ── Header band ── */}
        <div className="portrait-modal-head">
          <span className="portrait-modal-crest" aria-hidden="true">
            <CircleUser size={16} />
          </span>
          <h2 id="portrait-modal-title">Choose Character Portrait</h2>
          <button
            type="button"
            className="portrait-modal-close"
            onClick={handleCancel}
            aria-label="Close portrait selector"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body: library + selection ── */}
        <div className="portrait-modal-body">
          {/* ── Left: library ── */}
          <div className="portrait-modal-library">
            <div className="portrait-modal-library-head">
              <span className="portrait-modal-eyebrow">Portrait Library</span>
              <p>Pick a portrait for your character{hasSuggestions ? " — suggestions are sorted for your species first" : ""}.</p>
            </div>

            {/* Tabs */}
            <div className="portrait-modal-tabs" role="tablist" aria-label="Portrait views">
              {hasSuggestions ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "suggested"}
                  className={`portrait-modal-tab${tab === "suggested" ? " is-active" : ""}`}
                  onClick={() => setTab("suggested")}
                >
                  Suggested <span className="portrait-modal-tab-count">{suggestedPortraits.length}</span>
                </button>
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={tab === "all" || !hasSuggestions}
                className={`portrait-modal-tab${tab === "all" || !hasSuggestions ? " is-active" : ""}`}
                onClick={() => setTab("all")}
              >
                All Portraits <span className="portrait-modal-tab-count">{PORTRAITS.length}</span>
              </button>
            </div>

            {/* Grid */}
            <div className="portrait-modal-grid" role="radiogroup" aria-label="Portrait options">
              {displayPortraits.map((portrait, index) => {
                const isSelected = pendingId === portrait.id;
                return (
                  <button
                    key={portrait.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Portrait option ${index + 1}`}
                    className={`portrait-modal-tile${isSelected ? " is-selected" : ""}`}
                    onClick={() => setPendingId(portrait.id)}
                  >
                    <span className="portrait-modal-tile-art" style={portraitFrameCss(portrait.id)} aria-hidden="true" />
                    {isSelected ? (
                      <span className="portrait-modal-tile-check" aria-hidden="true">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: selection panel ── */}
          <div className="portrait-modal-selection">
            <span className="portrait-modal-eyebrow">Selected Portrait</span>
            <div className="portrait-modal-preview-ring">
              {pendingId ? (
                <CharacterPortrait
                  portraitId={pendingId}
                  characterName={characterName}
                  size={200}
                  shape="circle"
                  decorative
                  className="portrait-modal-preview-art"
                />
              ) : (
                <span className="portrait-modal-preview-empty" aria-hidden="true" />
              )}
            </div>
            {characterName ? <div className="portrait-modal-char-name">{characterName}</div> : null}
            <p className="portrait-modal-preview-copy">
              {pendingId
                ? "This portrait will appear on your character sheet and in the campaign party view."
                : "Choose a portrait from the library, or use your own image link."}
            </p>
            <hr className="portrait-modal-divider" />
            <button
              type="button"
              className="portrait-modal-link-toggle"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} aria-hidden="true" /> {uploading ? "Uploading…" : "Upload your own image"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              aria-label="Upload portrait image"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
            {uploadError ? <p className="portrait-modal-link-warn">{uploadError}</p> : null}
            <button
              type="button"
              className="portrait-modal-link-toggle"
              aria-expanded={linkOpen}
              onClick={() => setLinkOpen((v) => !v)}
            >
              <Link size={13} aria-hidden="true" /> Use an image link instead
            </button>
            {linkOpen ? (
              <div className="portrait-modal-link-row">
                <input
                  type="text"
                  aria-label="Portrait image link"
                  placeholder="https://… image link"
                  value={linkDraft}
                  maxLength={500}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyLink(); }}
                />
                <button type="button" onClick={applyLink} disabled={!linkDraft.trim() || linkInvalid}>
                  Apply
                </button>
              </div>
            ) : null}
            {linkOpen && linkInvalid ? (
              <p className="portrait-modal-link-warn">Enter a full http(s) image link or a site-relative image path.</p>
            ) : null}
          </div>
        </div>

        {/* ── Footer band ── */}
        <div className="portrait-modal-actions">
          <button type="button" className="portrait-modal-btn portrait-modal-btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="portrait-modal-btn portrait-modal-btn-save"
            disabled={!pendingId}
            onClick={handleSave}
          >
            Save Portrait
          </button>
        </div>
      </div>
    </div>
  );
});
