"use client";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : "Couldn't save. Reverted change.";

  return (
    <div
      className={`save-status-badge save-status-badge--${status}`}
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {label}
    </div>
  );
}
