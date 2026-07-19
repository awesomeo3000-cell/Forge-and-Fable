"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { X, CircleUser, Link, Upload } from "lucide-react";
import { PORTRAITS, PORTRAITS_BY_STYLE, portraitFrameCss } from "@/data/portraits";
import { useFocusTrap } from "@/lib/useFocusTrap";
import CharacterPortrait from "@/components/portraits/CharacterPortrait";
import type { PortraitOption, PortraitStyle } from "@/data/portraits";

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

type TabId = PortraitStyle | "all";

function isValidImageLink(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value);
}

/* Source images are cropped in the browser before the smaller result is uploaded. */
const UPLOAD_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_SOURCE_IMAGE_SIZE = 20 * 1024 * 1024;
const CROP_OUTPUT_SIZE = 512;
const DEFAULT_CROP_VIEWPORT_SIZE = 238;

type CropImageSize = { width: number; height: number };
type CropPosition = { x: number; y: number; zoom: number };
type CropDrag = { startX: number; startY: number; cropX: number; cropY: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cropMetrics(image: CropImageSize, zoom: number, viewportSize: number) {
  const scale = Math.max(viewportSize / image.width, viewportSize / image.height) * zoom;
  return { scale, width: image.width * scale, height: image.height * scale };
}

function validateUploadFile(file: File): string | null {
  if (!UPLOAD_MIME_TYPES.has(file.type)) return "Only PNG, JPEG, WebP, or GIF images are accepted.";
  if (file.size > MAX_SOURCE_IMAGE_SIZE) return `Image too large (max ${MAX_SOURCE_IMAGE_SIZE / 1024 / 1024} MB).`;
  return null;
}

async function createCroppedPortrait(
  sourceUrl: string,
  imageSize: CropImageSize,
  position: CropPosition,
  viewportSize: number,
): Promise<File> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The selected image could not be read."));
    image.src = sourceUrl;
  });

  const metrics = cropMetrics(imageSize, position.zoom, viewportSize);
  const overflowX = Math.max(0, metrics.width - viewportSize);
  const overflowY = Math.max(0, metrics.height - viewportSize);
  const sourceCropSize = viewportSize / metrics.scale;
  const sourceX = clamp((overflowX * (position.x / 100)) / metrics.scale, 0, image.naturalWidth - sourceCropSize);
  const sourceY = clamp((overflowY * (position.y / 100)) / metrics.scale, 0, image.naturalHeight - sourceCropSize);

  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the cropped image.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, sourceCropSize, sourceCropSize, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Your browser could not prepare the cropped image.")), "image/jpeg", 0.92);
  });
  return new File([blob], "portrait-crop.jpg", { type: "image/jpeg" });
}

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
  const [tab, setTab] = useState<TabId>("dreamwright");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropImageSize, setCropImageSize] = useState<CropImageSize | null>(null);
  const [cropPosition, setCropPosition] = useState<CropPosition>({ x: 50, y: 50, zoom: 1 });
  const [cropViewportSize, setCropViewportSize] = useState(DEFAULT_CROP_VIEWPORT_SIZE);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cropViewportRef = useRef<HTMLDivElement | null>(null);
  const cropDragRef = useRef<CropDrag | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useFocusTrap(open);

  // Reset pending state when modal opens.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setPendingId(value ?? null);
      setTab("dreamwright");
      setLinkOpen(false);
      setLinkDraft("");
      setUploading(false);
      setUploadError(null);
      setCropSource(null);
      setCropImageSize(null);
      setCropPosition({ x: 50, y: 50, zoom: 1 });
    }
  }, [open, value, suggestedAncestry]);

  useEffect(() => {
    return () => {
      if (cropSource) URL.revokeObjectURL(cropSource);
    };
  }, [cropSource]);

  useEffect(() => {
    const viewport = cropViewportRef.current;
    if (!viewport || !cropSource) return;
    const updateSize = () => setCropViewportSize(viewport.clientWidth || DEFAULT_CROP_VIEWPORT_SIZE);
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [cropSource]);

  const uploadPortrait = useCallback(async (file: File): Promise<boolean> => {
    setUploadError(null);
    const validationError = validateUploadFile(file);
    if (validationError) {
      setUploadError(validationError);
      return false;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/portraits", { method: "POST", body: formData });
      const data = (await response.json()) as { portraitUrl?: string; error?: string };
      if (!response.ok || !data.portraitUrl) {
        setUploadError(data.error ?? "The upload failed. Try again.");
        return false;
      }
      setPendingId(data.portraitUrl);
      return true;
    } catch {
      setUploadError("The upload failed. Check your connection and try again.");
      return false;
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFileSelected = useCallback((file: File) => {
    setUploadError(null);
    const validationError = validateUploadFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setCropSource(URL.createObjectURL(file));
    setCropImageSize(null);
    setCropPosition({ x: 50, y: 50, zoom: 1 });
  }, []);

  const clearCrop = useCallback(() => {
    setCropSource(null);
    setCropImageSize(null);
    setCropPosition({ x: 50, y: 50, zoom: 1 });
  }, []);

  const handleCropUpload = useCallback(async () => {
    if (!cropSource || !cropImageSize) return;
    setUploadError(null);
    try {
      const croppedFile = await createCroppedPortrait(cropSource, cropImageSize, cropPosition, cropViewportSize);
      if (await uploadPortrait(croppedFile)) clearCrop();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The cropped image could not be prepared.");
    }
  }, [clearCrop, cropImageSize, cropPosition, cropSource, cropViewportSize, uploadPortrait]);

  const handleCropPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!cropImageSize || !cropViewportRef.current) return;
    cropDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      cropX: cropPosition.x,
      cropY: cropPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [cropImageSize, cropPosition.x, cropPosition.y]);

  const handleCropPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = cropDragRef.current;
    if (!drag || !cropImageSize || !cropViewportRef.current) return;
    const metrics = cropMetrics(cropImageSize, cropPosition.zoom, cropViewportSize);
    const maxOverflowX = Math.max(0, metrics.width - cropViewportSize);
    const maxOverflowY = Math.max(0, metrics.height - cropViewportSize);
    setCropPosition((current) => ({
      ...current,
      x: maxOverflowX ? clamp(drag.cropX - ((event.clientX - drag.startX) / maxOverflowX) * 100, 0, 100) : 50,
      y: maxOverflowY ? clamp(drag.cropY - ((event.clientY - drag.startY) / maxOverflowY) * 100, 0, 100) : 50,
    }));
  }, [cropImageSize, cropPosition.zoom, cropViewportSize]);

  const stopCropDrag = useCallback(() => {
    cropDragRef.current = null;
  }, []);

  const cropPreviewMetrics = cropImageSize
    ? cropMetrics(cropImageSize, cropPosition.zoom, cropViewportSize)
    : null;

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

  const displayPortraits: readonly PortraitOption[] = useMemo(() => {
    let list = tab === "all" ? PORTRAITS : (PORTRAITS_BY_STYLE.get(tab) ?? PORTRAITS);
    // Sort suggested portraits first when an ancestry hint is available.
    if (suggestedAncestry) {
      const suggested = list.filter((p) => p.suggestedAncestries.includes(suggestedAncestry));
      const rest = list.filter((p) => !p.suggestedAncestries.includes(suggestedAncestry));
      list = [...suggested, ...rest];
    }
    return list;
  }, [tab, suggestedAncestry]);

  const dreamwrightCount = PORTRAITS_BY_STYLE.get("dreamwright")?.length ?? 0;
  const classicCount = PORTRAITS_BY_STYLE.get("classic")?.length ?? 0;

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
              <p>Pick a portrait for your character{suggestedAncestry ? " — matching portraits are sorted first" : ""}.</p>
            </div>

            {/* Tabs */}
            <div className="portrait-modal-tabs" role="tablist" aria-label="Portrait styles">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "dreamwright"}
                className={`portrait-modal-tab portrait-modal-tab-dw${tab === "dreamwright" ? " is-active" : ""}`}
                onClick={() => setTab("dreamwright")}
              >
                Dreamwright <span className="portrait-modal-tab-count">{dreamwrightCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "classic"}
                className={`portrait-modal-tab portrait-modal-tab-cl${tab === "classic" ? " is-active" : ""}`}
                onClick={() => setTab("classic")}
              >
                Classic <span className="portrait-modal-tab-count">{classicCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "all"}
                className={`portrait-modal-tab${tab === "all" ? " is-active" : ""}`}
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
            <div className={`portrait-modal-preview-ring${cropSource ? " is-cropping" : ""}`}>
              {cropSource ? (
                <div
                  ref={cropViewportRef}
                  className="portrait-modal-crop-viewport"
                  aria-label="Crop preview. Drag the image to reposition it."
                  onPointerDown={handleCropPointerDown}
                  onPointerMove={handleCropPointerMove}
                  onPointerUp={stopCropDrag}
                  onPointerCancel={stopCropDrag}
                >
                  <img
                    className="portrait-modal-crop-image"
                    src={cropSource}
                    alt=""
                    draggable={false}
                    onLoad={(event) => setCropImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                    style={cropPreviewMetrics ? {
                      width: cropPreviewMetrics.width,
                      height: cropPreviewMetrics.height,
                      left: -(cropPreviewMetrics.width - cropViewportSize) * (cropPosition.x / 100),
                      top: -(cropPreviewMetrics.height - cropViewportSize) * (cropPosition.y / 100),
                    } : { width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <span className="portrait-modal-crop-frame" aria-hidden="true" />
                </div>
              ) : pendingId ? (
                <CharacterPortrait
                  portraitId={pendingId}
                  characterName={characterName}
                  size={256}
                  shape="rounded"
                  decorative
                  className="portrait-modal-preview-art"
                />
              ) : (
                <span className="portrait-modal-preview-empty" aria-hidden="true" />
              )}
            </div>
            {characterName ? <div className="portrait-modal-char-name">{characterName}</div> : null}
            <p className="portrait-modal-preview-copy">
              {cropSource
                ? "Drag the image to choose what appears in the square portrait."
                : pendingId
                ? "This portrait will appear on your character sheet and in the campaign party view."
                : "Choose a portrait from the library, or use your own image link."}
            </p>
            <hr className="portrait-modal-divider" />
            <button
              type="button"
              className={`portrait-modal-link-toggle${cropSource ? " portrait-modal-upload-trigger-hidden" : ""}`}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} aria-hidden="true" /> {uploading ? "Uploading…" : "Upload your own image"}
            </button>
            {cropSource ? (
              <>
                <label className="portrait-modal-zoom-label" htmlFor="portrait-crop-zoom">
                  <span>Zoom</span>
                  <span>{cropPosition.zoom.toFixed(1)}x</span>
                </label>
                <input
                  id="portrait-crop-zoom"
                  className="portrait-modal-zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={cropPosition.zoom}
                  onChange={(event) => setCropPosition((current) => ({ ...current, zoom: Number(event.target.value), x: 50, y: 50 }))}
                />
                <div className="portrait-modal-crop-actions">
                  <button type="button" className="portrait-modal-crop-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    Choose another
                  </button>
                  <button type="button" className="portrait-modal-crop-primary" onClick={() => void handleCropUpload()} disabled={uploading || !cropImageSize}>
                    {uploading ? "Uploading..." : "Use this crop"}
                  </button>
                </div>
                <button type="button" className="portrait-modal-link-toggle" onClick={clearCrop} disabled={uploading}>
                  Cancel crop
                </button>
              </>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              aria-label="Upload portrait image"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelected(file);
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
            disabled={!pendingId || !!cropSource || uploading}
            onClick={handleSave}
          >
            Save Portrait
          </button>
        </div>
      </div>
    </div>
  );
});
