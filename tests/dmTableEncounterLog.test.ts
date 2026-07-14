import { describe, expect, it } from "vitest";
import { groupEncounterLog, logEntryVoice, type LogRecord } from "@/lib/dmTable/encounterLog";

const at = (secondsAgo: number) => new Date(Date.parse("2026-07-13T20:00:00.000Z") - secondsAgo * 1000).toISOString();

const roll = (id: string, secondsAgo: number, label: string, characterName: string, total: number): LogRecord =>
  ({ id, kind: "rolls", at: at(secondsAgo), text: `${characterName} — ${label} ${total}`, roll: { characterName, label, total } });

const event = (id: string, secondsAgo: number, eventType: string, text = "Table event."): LogRecord =>
  ({ id, kind: "table", at: at(secondsAgo), eventType, text });

describe("encounter log grouping", () => {
  it("collapses same-label rolls inside the window into one entry, newest first", () => {
    const entries = groupEncounterLog([
      roll("r1", 0, "Perception check", "Elowen", 18),
      roll("r2", 30, "Perception check", "Bram", 12),
      roll("r3", 70, "Perception check", "Nyx", 9),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: "roll-group", label: "Perception check" });
    if (entries[0].type === "roll-group") {
      expect(entries[0].rolls.map((item) => item.roll?.total)).toEqual([18, 12, 9]);
      expect(entries[0].at).toBe(at(0));
    }
  });

  it("keeps a lone roll as a plain entry", () => {
    const entries = groupEncounterLog([roll("r1", 0, "Stealth check", "Nyx", 21)]);
    expect(entries).toEqual([{ type: "single", record: expect.objectContaining({ id: "r1" }) }]);
  });

  it("does not merge a same-label roll from an earlier request outside the window", () => {
    const entries = groupEncounterLog([
      roll("r1", 0, "Perception check", "Elowen", 18),
      roll("r2", 40, "Perception check", "Bram", 12),
      roll("r3", 1000, "Perception check", "Nyx", 9),
    ]);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe("roll-group");
    expect(entries[1]).toMatchObject({ type: "single", record: expect.objectContaining({ id: "r3" }) });
  });

  it("groups across interleaved table events without reordering them", () => {
    const entries = groupEncounterLog([
      roll("r1", 0, "Dexterity saving throw", "Elowen", 14),
      event("e1", 10, "announce"),
      roll("r2", 20, "Dexterity saving throw", "Bram", 7),
    ]);
    expect(entries.map((entry) => entry.type)).toEqual(["roll-group", "single"]);
    if (entries[0].type === "roll-group") expect(entries[0].rolls).toHaveLength(2);
  });

  it("keeps different labels apart even when simultaneous", () => {
    const entries = groupEncounterLog([
      roll("r1", 0, "Perception check", "Elowen", 18),
      roll("r2", 0, "Insight check", "Bram", 12),
    ]);
    expect(entries.every((entry) => entry.type === "single")).toBe(true);
  });
});

describe("encounter log voice", () => {
  it("separates announcements, death saves, and plain mechanics", () => {
    expect(logEntryVoice(event("e1", 0, "announce"))).toBe("announce");
    expect(logEntryVoice(event("e2", 0, "death-save-update"))).toBe("danger");
    expect(logEntryVoice(event("e3", 0, "rest-short"))).toBe("plain");
    expect(logEntryVoice(roll("r1", 0, "Perception check", "Elowen", 18))).toBe("plain");
  });
});
