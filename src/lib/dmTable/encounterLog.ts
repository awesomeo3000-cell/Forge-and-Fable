/**
 * Encounter-log presentation rules (Round Four A2). The log is a VIEW over
 * the persistent record feed (campaign rolls + table events) — no new data,
 * no new server linkage. Rolls that answer one request collapse into a
 * single group entry, matched by their shared label within a time window.
 */

export type LogRecord = {
  id: string;
  kind: "rolls" | "table";
  /** ISO timestamp. */
  at: string;
  text: string;
  /** Table events only: the CampaignEvent type, for voice separation. */
  eventType?: string;
  /** True when the record came from a rehearsal ghost. */
  ghost?: boolean;
  /** Roll records only: structured fields for grouping. */
  roll?: { characterName: string; label: string; total: number };
};

export type LogEntry =
  | { type: "single"; record: LogRecord }
  | { type: "roll-group"; id: string; at: string; label: string; rolls: LogRecord[] };

/** Rolls answering one request land close together; 5 minutes is generous. */
export const ROLL_GROUP_WINDOW_MS = 5 * 60_000;

/**
 * Collapse same-label rolls within the window into one entry. Input must be
 * newest-first (the feed's order); groups keep that order and adopt the
 * newest member's timestamp. A lone roll stays a plain entry.
 */
export function groupEncounterLog(records: LogRecord[], windowMs = ROLL_GROUP_WINDOW_MS): LogEntry[] {
  const entries: LogEntry[] = [];
  const used = new Set<number>();
  for (let index = 0; index < records.length; index++) {
    if (used.has(index)) continue;
    const record = records[index];
    if (record.kind !== "rolls" || !record.roll) {
      entries.push({ type: "single", record });
      continue;
    }
    const rolls = [record];
    used.add(index);
    let oldestAt = Date.parse(record.at);
    for (let candidateIndex = index + 1; candidateIndex < records.length; candidateIndex++) {
      if (used.has(candidateIndex)) continue;
      const candidate = records[candidateIndex];
      if (candidate.kind !== "rolls" || !candidate.roll || candidate.roll.label !== record.roll.label) continue;
      const candidateAt = Date.parse(candidate.at);
      // Newest-first: once a same-label roll falls outside the window, every
      // remaining one is older still — it belongs to an earlier request.
      if (oldestAt - candidateAt > windowMs) break;
      rolls.push(candidate);
      used.add(candidateIndex);
      oldestAt = candidateAt;
    }
    if (rolls.length >= 2) entries.push({ type: "roll-group", id: record.id, at: record.at, label: record.roll.label, rolls });
    else entries.push({ type: "single", record });
  }
  return entries;
}

/**
 * Voice separation: announcements read as italic marginalia, death-save and
 * critical-HP events carry the seal tint, everything mechanical stays plain.
 */
export function logEntryVoice(record: LogRecord): "announce" | "danger" | "plain" {
  if (record.eventType === "announce") return "announce";
  if (record.eventType === "death-save-update") return "danger";
  return "plain";
}
