"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Upload, X, Check, AlertTriangle, HelpCircle, FileText, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import type { ImportDraft, ImportField, ImportConfidence } from "@/lib/import/pdfTypes";
import type { AbilityKey } from "@/types/game";
import { abilityLabels } from "@/lib/utils";
import { analyzePdf, createCharacterFromPdfDraft } from "@/lib/client/importApi";

// ── Types ──

type ImportStep = "upload" | "review" | "creating";

type Props = {
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

function EditableTextRow({
  label,
  field,
  onChange,
}: {
  label: string;
  field: ImportField<string>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="import-field-row">
      <label className="import-field-label">{label}</label>
      <input
        className={`import-field-input import-val-${field.confidence}`}
        value={field.value ?? ""}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      <ConfidenceBadge confidence={field.confidence} />
      {field.note && <span className="import-field-note">{field.note}</span>}
    </div>
  );
}

function EditableNumberRow({
  label,
  field,
  min,
  max,
  onChange,
}: {
  label: string;
  field: ImportField<number>;
  min?: number;
  max?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="import-field-row">
      <label className="import-field-label">{label}</label>
      <input
        className={`import-field-input import-val-${field.confidence}`}
        type="number"
        min={min}
        max={max}
        value={field.value ?? ""}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      <ConfidenceBadge confidence={field.confidence} />
      {field.note && <span className="import-field-note">{field.note}</span>}
    </div>
  );
}

// ── Main modal ──

export default memo(function CharacterImportModal({ onCreated, onClose }: Props) {
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

  const updateStringField = (field: ImportField<string>, value: string): ImportField<string> => {
    const clean = value.trim();
    return {
      ...field,
      value: clean ? value : null,
      confidence: clean ? "review" : "missing",
      note: field.confidence === "confirmed" ? "Edited before import" : field.note,
    };
  };

  const updateNumberField = (field: ImportField<number>, value: string): ImportField<number> => {
    const clean = value.trim();
    const parsed = clean === "" ? null : Number(clean);
    return {
      ...field,
      value: parsed !== null && Number.isInteger(parsed) ? parsed : null,
      confidence: parsed !== null && Number.isInteger(parsed) ? "review" : "missing",
      note: field.confidence === "confirmed" ? "Edited before import" : field.note,
    };
  };

  const updateIdentityText = (key: "name" | "className" | "species" | "background", value: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        identity: {
          ...current.identity,
          [key]: updateStringField(current.identity[key], value),
        },
      };
    });
  };

  const updateIdentityLevel = (value: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        identity: {
          ...current.identity,
          level: updateNumberField(current.identity.level, value),
        },
      };
    });
  };

  const updateAbility = (key: AbilityKey, value: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        abilities: {
          ...current.abilities,
          [key]: updateNumberField(current.abilities[key], value),
        },
      };
    });
  };

  const updateVitalNumber = (key: "maxHp" | "currentHp" | "tempHp" | "armorClass" | "initiative", value: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        vitals: {
          ...current.vitals,
          [key]: updateNumberField(current.vitals[key], value),
        },
      };
    });
  };

  const updateSpeed = (value: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        vitals: {
          ...current.vitals,
          speed: updateStringField(current.vitals.speed, value),
        },
      };
    });
  };

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".pdf") && selectedFile.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      return;
    }
    setFile(selectedFile);
    setError("");
    setBusy(true);

    try {
      const draft = await analyzePdf(selectedFile);
      setDraft(draft);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error — please try again.");
    }
    setBusy(false);
  };

  // ── Create character from draft ──

  const handleCreate = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");

    try {
      await createCharacterFromPdfDraft(draft);
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
  const canCreate = Boolean(
    draft?.identity.name.value &&
      draft.identity.className.value &&
      draft.identity.species.value &&
      draft.identity.level.value &&
      abilityOrder.every((key) => typeof draft.abilities[key].value === "number"),
  );

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
              {/* Confidence summary: count confirmed / needs-review / missing fields */}
              {(() => {
                const collect = (obj: Record<string, ImportField<unknown>>) => Object.values(obj);
                const allFields: ImportField<unknown>[] = [
                  ...collect(draft.identity),
                  ...collect(draft.abilities),
                  ...collect(draft.vitals),
                  ...collect(draft.proficiencies),
                  draft.notes.features,
                  draft.notes.backstory,
                  draft.notes.personality,
                  draft.notes.appearance,
                ];
                const confirmed = allFields.filter((f) => f?.confidence === "confirmed").length;
                const review = allFields.filter((f) => f?.confidence === "review").length;
                const missing = allFields.filter((f) => f?.confidence === "missing").length;
                const total = confirmed + review + missing;
                if (total === 0) return null;
                return (
                  <div className="import-confidence-summary" style={{ marginTop: 6, display: "flex", gap: 10, fontSize: "0.82rem" }}>
                    <span title="High confidence" style={{ color: "var(--ok)" }}>&#x2713; {confirmed} confirmed</span>
                    <span title="Needs review" style={{ color: "var(--warn)" }}>&#x26A0; {review} need review</span>
                    {missing > 0 && <span title="Not found" style={{ color: "var(--ink-faint)" }}>? {missing} missing</span>}
                  </div>
                );
              })()}
            </div>

            {/* Identity */}
            <section className="import-section">
              <h3>Identity</h3>
              <EditableTextRow label="Name" field={draft.identity.name} onChange={(value) => updateIdentityText("name", value)} />
              <EditableTextRow label="Class" field={draft.identity.className} onChange={(value) => updateIdentityText("className", value)} />
              <EditableNumberRow label="Level" field={draft.identity.level} min={1} max={20} onChange={updateIdentityLevel} />
              <EditableTextRow label="Species" field={draft.identity.species} onChange={(value) => updateIdentityText("species", value)} />
              <EditableTextRow label="Background" field={draft.identity.background} onChange={(value) => updateIdentityText("background", value)} />
            </section>

            {/* Ability scores */}
            <section className="import-section">
              <h3>Ability Scores</h3>
              {abilityOrder.map((key) => (
                <EditableNumberRow
                  key={key}
                  label={abilityLabels[key]}
                  field={draft.abilities[key]}
                  min={1}
                  max={30}
                  onChange={(value) => updateAbility(key, value)}
                />
              ))}
            </section>

            {/* Vitals */}
            <section className="import-section">
              <h3>Vitals</h3>
              <EditableNumberRow label="Max HP" field={draft.vitals.maxHp} min={1} max={999} onChange={(value) => updateVitalNumber("maxHp", value)} />
              <EditableNumberRow label="Current HP" field={draft.vitals.currentHp} min={0} max={999} onChange={(value) => updateVitalNumber("currentHp", value)} />
              <EditableNumberRow label="Temp HP" field={draft.vitals.tempHp} min={0} max={999} onChange={(value) => updateVitalNumber("tempHp", value)} />
              <EditableNumberRow label="AC (review hint)" field={draft.vitals.armorClass} min={1} max={99} onChange={(value) => updateVitalNumber("armorClass", value)} />
              <EditableNumberRow label="Initiative (review hint)" field={draft.vitals.initiative} min={-99} max={99} onChange={(value) => updateVitalNumber("initiative", value)} />
              <EditableTextRow label="Speed" field={draft.vitals.speed} onChange={updateSpeed} />
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
            {!canCreate && (
              <div className="import-warning">
                <AlertTriangle size={16} />
                <span>Name, class, species, level, and all six ability scores are required before creation.</span>
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
                disabled={busy || !canCreate}
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
