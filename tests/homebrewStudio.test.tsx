/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomebrewStudio from "@/components/HomebrewStudio";

const definition = {
  id: "definition-1",
  kind: "item",
  ruleset: "2014",
  title: "Test item",
  slug: "test-item",
  visibility: "private",
  archived: false,
  revision: 0,
  currentVersionId: "version-1",
  latestPublishedVersionId: null,
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("HomebrewStudio interactions", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/api/homebrew")) {
        return response({ definition, version: { id: "version-1", ordinal: 1, status: "draft", changeSummary: "Initial", baseline: null, payload: JSON.parse(String(init.body)).payload } }, 201);
      }
      return response({ definitions: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("authors a structured attunement prerequisite and sends it in the save payload", async () => {
    const onClose = vi.fn();
    render(<HomebrewStudio onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("Requires attunement"));
    fireEvent.click(screen.getByRole("button", { name: /Add structured rule/i }));
    fireEvent.change(screen.getAllByLabelText("Prerequisite type")[0], { target: { value: "ability" } });
    fireEvent.change(screen.getByLabelText("Minimum"), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: /Save version/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/homebrew", expect.objectContaining({ method: "POST" })));
    const saveCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    const saved = JSON.parse(String((saveCall?.[1] as RequestInit).body)) as { payload: { attunementPrerequisites?: { rules?: unknown } } };
    expect(saved.payload.attunementPrerequisites?.rules).toEqual({ op: "ability", ability: "strength", minimum: 18 });
  });

  it("authors ordered stages with counter activation and saves normalized orders", async () => {
    const onClose = vi.fn();
    render(<HomebrewStudio onClose={onClose} />);

    // Two stages; orders must save as 1 and 2 regardless of insertion.
    fireEvent.click(screen.getByRole("button", { name: /Add stage/i }));
    fireEvent.click(screen.getByRole("button", { name: /Add stage/i }));
    fireEvent.change(screen.getByLabelText("Stage 1 name"), { target: { value: "Dormant" } });
    fireEvent.change(screen.getByLabelText("Stage 2 name"), { target: { value: "Stirring" } });

    // Second stage is reached by a counter threshold.
    const activationSelects = screen.getAllByLabelText(/Reached by/i);
    fireEvent.change(activationSelects[1], { target: { value: "counter" } });
    fireEvent.change(screen.getByLabelText("Counter id"), { target: { value: "kills" } });
    fireEvent.change(screen.getByLabelText("Threshold"), { target: { value: "10" } });

    fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "Dawnbringer" } });
    fireEvent.click(screen.getByRole("button", { name: /Save version/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/homebrew", expect.objectContaining({ method: "POST" })));
    const saveCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    const saved = JSON.parse(String((saveCall?.[1] as RequestInit).body)) as {
      payload: { stages: Array<{ name: string; order: number; activation: Record<string, unknown> }> };
    };
    expect(saved.payload.stages.map((stage) => ({ name: stage.name, order: stage.order }))).toEqual([
      { name: "Dormant", order: 1 },
      { name: "Stirring", order: 2 },
    ]);
    expect(saved.payload.stages[1].activation).toEqual({ type: "counter", counterId: "kills", minimum: 10 });
  });

  it("traps Tab focus and restores the opener after Escape closes the dialog", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Open Item Studio";
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(<HomebrewStudio onClose={onClose} />);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("dialog")));
    const focusable = screen.getByRole("dialog").querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])");
    const last = focusable[focusable.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(focusable[0]);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
