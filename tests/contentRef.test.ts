import { describe, expect, it } from "vitest";
import { validateContentRef } from "@/lib/homebrew/homebrewSchema";
import type { RulesContentRef } from "@/types/homebrew";

const ok = (ref: unknown) => validateContentRef(ref).length === 0;
const paths = (ref: unknown) => validateContentRef(ref).map((e) => e.path);

describe("validateContentRef", () => {
  it("accepts a well-formed built-in reference", () => {
    const ref: RulesContentRef = { source: "builtin", kind: "class", id: "wizard", ruleset: "2014" };
    expect(ok(ref)).toBe(true);
  });

  it("accepts a built-in spell reference", () => {
    expect(ok({ source: "builtin", kind: "spell", id: "fireball", ruleset: "2014" })).toBe(true);
  });

  it("accepts a well-formed homebrew reference with a pinned version", () => {
    const ref: RulesContentRef = {
      source: "homebrew",
      kind: "item",
      definitionId: "def_1",
      versionId: "ver_1",
      ruleset: "2024",
    };
    expect(ok(ref)).toBe(true);
  });

  it("rejects a homebrew reference missing its immutable versionId", () => {
    const errors = validateContentRef({
      source: "homebrew",
      kind: "item",
      definitionId: "def_1",
      ruleset: "2024",
    });
    expect(errors.some((e) => e.path === "ref.versionId")).toBe(true);
  });

  it("rejects an unknown source", () => {
    expect(paths({ source: "marketplace", kind: "item", id: "x", ruleset: "2014" })).toContain("ref.source");
  });

  it("rejects an unknown ruleset", () => {
    expect(paths({ source: "builtin", kind: "class", id: "wizard", ruleset: "5e" })).toContain("ref.ruleset");
  });

  it("rejects a homebrew reference whose kind is 'spell'", () => {
    // 'spell' is only valid for built-in references.
    expect(paths({ source: "homebrew", kind: "spell", definitionId: "d", versionId: "v", ruleset: "2014" })).toContain(
      "ref.kind",
    );
  });

  it("rejects non-object input without throwing", () => {
    expect(ok(null)).toBe(false);
    expect(ok("class")).toBe(false);
    expect(ok(42)).toBe(false);
  });
});
