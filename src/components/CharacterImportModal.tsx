"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Upload, X, Check, AlertTriangle, HelpCircle, FileText, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import type { ImportDraft, ImportField, ImportConfidence } from "@/lib/import/pdfTypes";
import type { AbilityKey } from "@/types/game";
import { abilityLabels } from "@/lib/utils";

// ── Types ──

type ImportStep = "upload" | "review" | "creating";

type Props = {
  token: string;
  onCreated: () => void;
  onClose: () => void;
};

// ── Confidence badge ──

function ConfidenceBadge({ confidence }: { confidence: ImportConfidence }) {
  const config = {
    confirmed: { icon: Check, className: "import-conf-badge import-conf-confirmed", label: "Confirmed" },
    review: { icon: AlertTriangle, className: "import-conf-badge import-conf-review", label: "Needs review" },
    missing: { icon: HelpCircle, className: "import-conf-badge import-conf-missing", label: "Not found" },
  };
  const { icon: Icon, className, label } = config[confidence];
  return (
    <span className={className} title={label}>
      <Icon size={12} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// ── Field row for review ──

function FieldRow({
  label,
  field,
  fallback,
  render,
}: {
  label: string;
  field: ImportField<unknown>;
  fallback?: string;
  render?: (value: unknown) => string;
}) {
  const display = field.value != null ? (render ? render(field.value) : String(field.value)) : (fallback ?? "—");
  return (
    <div className="import-field-row">
      <span className="import-field-label">{label}</span>
      <span className={`import-field-value import-val-${field.confidence}`}>{display}</span>
      <ConfidenceBadge confidence={field.confidence} />
      {field.note && <span className="import-field-note">{field.note}</span>}
    </div>
  );
}

// ── Main modal ──

export default memo(function CharacterImportModal({ token, onCreated, onClose }: Props) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
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
  }, [onClose]);

  // ── Upload & analyze ──

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".pdf") && selectedFile.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      return;
    }
    setFile(selectedFile);
    setError("");
    setBusy(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/import/pdf/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to analyze PDF.");
        setBusy(false);
        return;
      }

      setDraft(data.draft);
      setStep("review");
    } catch {
      setError("Network error — please try again.");
    }
    setBusy(false);
  };

  // ── Create character from draft ──

  const handleCreate = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/import/pdf/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ draft }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create character.");
        setBusy(false);
        return;
      }

      setStep("creating");
      onCreated();
    } catch {
      setError("Network error — please try again.");
    }
    setBusy(false);
  };

  // ── Drag & drop handlers ──

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  // ── Render ──

  const abilityOrder: AbilityKey[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

  return createPortal(
    <div className="modal-scrim" role="presentation" onMouseDown={step === "creating" ? undefined : onClose}>
      <section
        className="import-modal paper-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, maxHeight: "90vh", overflow: "auto" }}
      >
        {/* Header */}
        <div className="import-modal-header">
          <h2 id="import-modal-title">
            <FileText size={20} style={{ marginRight: 8 }} />
            Import Character from PDF
          </h2>
          <button className="glass-icon modal-close" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Error banner */}
        {error && <div className="import-error-banner">{error}</div>}

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="import-upload-area">
            <div
              className={`import-dropzone ${dragOver ? "import-dropzone-active" : ""}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Click or drop a PDF file to import"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            >
              <Upload size={40} className="cs-muted" />
              <p style={{ marginTop: 12, fontWeight: 600 }}>Drop your PDF here or click to browse</p>
              <p className="cs-muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
                D&D Beyond character sheets, fillable PDFs, and most standard formats are supported.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>

            {busy && (
              <div className="import-busy">
                <Loader2 size={20} className="spin" />
                <span>Analyzing PDF…</span>
              </div>
            )}

            {file && !busy && !draft && (
              <div className="import-file-info">
                <FileText size={16} />
                <span>{file.name}</span>
                <span className="cs-muted">({(file.size / 1024).toFixed(0)} KB)</span>
              </div>
            )}
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && draft && (
          <div className="import-review">
            {/* Summary banner */}
            <div className="import-summary">
              <strong>
                {draft.source.kind === "dnd-beyond" ? "D&D Beyond" : draft.source.kind === "fillable-pdf" ? "Fillable PDF" : "PDF"}
                {" "}sheet · {draft.source.pages} pages
              </strong>
              {draft.identity.name.value && (
                <p style={{ marginTop: 4 }}>
                  We found a{" "}
                  {draft.identity.level.value ? `Level ${draft.identity.level.value} ` : ""}
                  {draft.identity.species.value ? `${draft.identity.species.value} ` : ""}
                  {draft.identity.className.value ?? "character"}
                  {draft.identity.name.value ? ` named ${draft.identity.name.value}` : ""}.
                </p>
              )}
            </div>

            {/* Identity */}
            <section className="import-section">
              <h3>Identity</h3>
              <FieldRow label="Name" field={draft.identity.name} />
              <FieldRow label="Class" field={draft.identity.className} />
              <FieldRow label="Level" field={draft.identity.level} />
              <FieldRow label="Species" field={draft.identity.species} />
              <FieldRow label="Background" field={draft.identity.background} />
            </section>

            {/* Ability scores */}
            <section className="import-section">
              <h3>Ability Scores</h3>
              {abilityOrder.map((key) => (
                <FieldRow
                  key={key}
                  label={abilityLabels[key]}
                  field={draft.abilities[key]}
                  fallback="10"
                />
              ))}
            </section>

            {/* Vitals */}
            <section className="import-section">
              <h3>Vitals</h3>
              <FieldRow label="Max HP" field={draft.vitals.maxHp} />
              <FieldRow label="AC (review hint)" field={draft.vitals.armorClass} />
              <FieldRow label="Initiative (review hint)" field={draft.vitals.initiative} />
              <FieldRow label="Speed" field={draft.vitals.speed} />
            </section>

            {/* Proficiencies */}
            {(draft.proficiencies.savingThrows.confidence !== "missing" ||
              draft.proficiencies.skills.confidence !== "missing" ||
              draft.proficiencies.languages.confidence !== "missing") && (
              <section className="import-section">
                <h3>Proficiencies</h3>
                {draft.proficiencies.savingThrows.confidence !== "missing" && (
                  <FieldRow
                    label="Saving Throws"
                    field={draft.proficiencies.savingThrows}
                    render={(v) => (v as string[]).join(", ")}
                  />
                )}
                {draft.proficiencies.skills.confidence !== "missing" && (
                  <FieldRow
                    label="Skills"
                    field={draft.proficiencies.skills}
                    render={(v) => (v as string[]).join(", ")}
                  />
                )}
                {draft.proficiencies.armor.confidence !== "missing" && (
                  <FieldRow
                    label="Armor"
                    field={draft.proficiencies.armor}
                    render={(v) => (v as string[]).join(", ")}
                  />
                )}
                {draft.proficiencies.weapons.confidence !== "missing" && (
                  <FieldRow
                    label="Weapons"
                    field={draft.proficiencies.weapons}
                    render={(v) => (v as string[]).join(", ")}
                  />
                )}
                {draft.proficiencies.languages.confidence !== "missing" && (
                  <FieldRow
                    label="Languages"
                    field={draft.proficiencies.languages}
                    render={(v) => (v as string[]).join(", ")}
                  />
                )}
                {draft.proficiencies.tools.confidence !== "missing" && (
                  <FieldRow
                    label="Tools"
                    field={draft.proficiencies.tools}
                    render={(v) => (v as string[]).join(", ")}
                  />
                )}
              </section>
            )}

            {/* Attacks */}
            {draft.attacks.length > 0 && (
              <section className="import-section">
                <h3>Attacks ({draft.attacks.length})</h3>
                {draft.attacks.map((atk, i) => (
                  <FieldRow
                    key={i}
                    label={atk.value?.name ?? `Attack ${i + 1}`}
                    field={atk}
                    render={(v) => {
                      const a = v as ImportDraft["attacks"][number]["value"];
                      return a ? `${a.hit} · ${a.damage}` : "—";
                    }}
                  />
                ))}
              </section>
            )}

            {/* Spells */}
            {draft.spells.length > 0 && (
              <section className="import-section">
                <h3>Spells ({draft.spells.length})</h3>
                <div className="import-spell-list">
                  {draft.spells.map((spell, i) => (
                    <span key={i} className="import-spell-chip">
                      {spell.value?.name ?? `Spell ${i + 1}`}
                      <ConfidenceBadge confidence={spell.confidence} />
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Notes */}
            {(draft.notes.features.confidence !== "missing" ||
              draft.notes.backstory.confidence !== "missing" ||
              draft.notes.personality.confidence !== "missing") && (
              <section className="import-section">
                <h3>Notes & Flavor</h3>
                <FieldRow label="Features" field={draft.notes.features} render={(v) => `${String(v).slice(0, 100)}…`} />
                <FieldRow label="Backstory" field={draft.notes.backstory} render={(v) => `${String(v).slice(0, 100)}…`} />
                <FieldRow label="Personality" field={draft.notes.personality} render={(v) => `${String(v).slice(0, 100)}…`} />
              </section>
            )}

            {/* Missing required warning */}
            {(!draft.identity.name.value || !draft.identity.className.value || !draft.identity.level.value) && (
              <div className="import-warning">
                <AlertTriangle size={16} />
                <span>Name, class, and level are required before creation. Fill in missing fields.</span>
              </div>
            )}

            {/* Actions */}
            <div className="import-actions">
              <button
                type="button"
                className="glass-button"
                onClick={() => setStep("upload")}
                disabled={busy}
              >
                ← Back
              </button>
              <button
                type="button"
                className="dj-btn dj-btn-primary"
                onClick={handleCreate}
                disabled={busy || !draft.identity.name.value || !draft.identity.className.value || !draft.identity.level.value}
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className="spin" style={{ marginRight: 8 }} />
                    Creating…
                  </>
                ) : (
                  "Create Character"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step: Creating (success) */}
        {step === "creating" && (
          <div className="import-success">
            <Check size={48} style={{ color: "var(--accent)" }} />
            <h3>Character Created!</h3>
            <p>Your imported character is ready. You can now customize it from the character sheet.</p>
            <button type="button" className="dj-btn dj-btn-primary" onClick={onClose}>
              View Character
            </button>
          </div>
        )}

        {/* Spinner fallback */}
        {busy && step !== "upload" && step !== "creating" && (
          <div className="import-busy">
            <Loader2 size={24} className="spin" />
            <span>Processing…</span>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
});
