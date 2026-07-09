import type { ImportDraft } from "@/lib/import/pdfTypes";
import type { Character } from "@/types/game";

export async function analyzePdf(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/import/pdf/analyze", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await response.json() as { draft?: ImportDraft; error?: string };

  if (!response.ok || !data.draft) {
    throw new Error(data.error ?? "Failed to analyze PDF.");
  }

  return data.draft;
}

export async function createCharacterFromPdfDraft(draft: ImportDraft) {
  const response = await fetch("/api/import/pdf/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ draft }),
  });

  const data = await response.json() as { character?: Character; error?: string };

  if (!response.ok || !data.character) {
    throw new Error(data.error ?? "Failed to create character.");
  }

  return data.character;
}
