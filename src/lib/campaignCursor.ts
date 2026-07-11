export type CampaignCursorState = {
  events?: string;
  rolls?: string;
};

export function encodeCampaignCursor(row: { created_at: string; id: string }): string {
  return `${row.created_at}|${row.id}`;
}

export function decodeCampaignCursor(raw?: string): { createdAt: string; id: string } {
  if (!raw) return { createdAt: "0000-01-01T00:00:00.000Z", id: "" };
  const separator = raw.indexOf("|");
  const createdAt = separator >= 0 ? raw.slice(0, separator) : raw;
  const id = separator >= 0 ? raw.slice(separator + 1) : "";
  if (Number.isNaN(Date.parse(createdAt))) {
    return { createdAt: "0000-01-01T00:00:00.000Z", id: "" };
  }
  return { createdAt, id };
}
