"use client";

import { useRef, useState } from "react";
import { FolderOpen, Upload, X } from "lucide-react";
import { dmToolsApi } from "@/lib/client/dmToolsApi";

type Props = {
  campaignId: string;
  onClose: () => void;
  onUploaded: () => void;
};

export default function CampaignHandoutUploadModal({ campaignId, onClose, onUploaded }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("other");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setFiles((current) => {
      const merged = [...current, ...Array.from(incoming)];
      const unique = new Map(merged.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
      return [...unique.values()];
    });
  };

  const upload = async () => {
    if (!files.length) return;
    setBusy(true); setError("");
    let completed = 0;
    try {
      for (const file of files) {
        setProgress(`Uploading ${completed + 1} of ${files.length}: ${file.name}`);
        await dmToolsApi.uploadHandout(campaignId, file, {
          title: file.name,
          category,
        });
        completed += 1;
      }
      setFiles([]);
      setProgress(`${completed} handout${completed === 1 ? "" : "s"} uploaded privately. Select a file in Handouts to share it.`);
      if (fileInput.current) fileInput.current.value = "";
      if (folderInput.current) folderInput.current.value = "";
      onUploaded();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload the handouts.");
      setProgress(completed ? `${completed} uploaded; the remaining files were not sent.` : "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={onClose}>
      <section className="campaign-handout-upload" role="dialog" aria-modal="true" aria-labelledby="campaign-handout-upload-title" aria-describedby="campaign-handout-upload-hint" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span className="ao-dash-eyebrow">Campaign handouts</span><h2 id="campaign-handout-upload-title">Upload files</h2></div>
          <button type="button" className="modal-close glass-icon" onClick={onClose} aria-label="Close upload dialog"><X size={18} /></button>
        </header>
        <div className="campaign-handout-upload-intro"><p id="campaign-handout-upload-hint">Upload maps, letters, PDFs, images, or reference files. Select multiple files or an entire folder. Files stay private until you share them.</p><span>80 MB max per file</span></div>
        <div className="campaign-handout-upload-actions">
          <button type="button" className="ao-cw-btn ao-cw-btn-primary" onClick={() => fileInput.current?.click()} disabled={busy}><Upload size={15} /> Choose files</button>
          <button type="button" className="ao-cw-btn" onClick={() => folderInput.current?.click()} disabled={busy}><FolderOpen size={15} /> Choose folder</button>
          <input ref={fileInput} hidden type="file" multiple accept="image/*,application/pdf,.txt,.md,.docx,.zip" onChange={(event) => addFiles(event.target.files)} />
          <input ref={folderInput} hidden type="file" multiple accept="image/*,application/pdf,.txt,.md,.docx,.zip" onChange={(event) => addFiles(event.target.files)} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
        </div>
        <div className="campaign-handout-upload-fields"><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)} disabled={busy}>{["location", "npc", "item", "letter", "clue", "map", "lore", "other"].map((value) => <option key={value}>{value}</option>)}</select></label></div>
        <div className="campaign-handout-upload-selection"><span>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Files to upload"}</span><small>{files.length ? "Review the list before uploading." : "Choose files or a folder to begin."}</small></div>
        <div className="campaign-handout-upload-list" aria-live="polite">
          {files.length ? <ul>{files.map((file) => <li key={`${file.name}:${file.size}:${file.lastModified}`}><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))} disabled={busy} aria-label={`Remove ${file.name}`}><X size={13} /></button></li>)}</ul> : <p>No files selected yet.</p>}
        </div>
        {progress ? <p className="campaign-handout-upload-status">{progress}</p> : null}
        {error ? <p className="campaign-handout-upload-error">{error}</p> : null}
        <footer><button type="button" className="ao-cw-btn" onClick={onClose} disabled={busy}>Close</button><button type="button" className="ao-cw-btn ao-cw-btn-primary" onClick={() => void upload()} disabled={busy || files.length === 0}><Upload size={15} /> {busy ? "Uploading…" : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`}</button></footer>
      </section>
    </div>
  );
}
