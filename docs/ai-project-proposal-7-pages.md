# Forge & Fable — Round 7: Custom Character Pages

**Audience:** Codex 5.5 (or comparable) in a fresh session.
**Repo root:** `E:\forge-and-fable`
**Feature:** players can add extra pages to a character sheet — journal entries, backstory, maps, portraits — as titled pages of text and image blocks.

## 1. Context (read first)

Next.js 16 / React 19 / TypeScript. Character data is a JSON file vault behind `src/app/api/characters/*` with a strict field allowlist + validation in `src/lib/validateCharacter.ts` (follow the `effects` case as the model — it validates array length, per-entry shapes, string caps, and throws readable errors). The sheet is `src/components/HeroSheet.tsx`: sections render via `sectionContent(id)` keyed by `SheetSectionId` (`src/types/game.ts`) with titles/default placement in `src/lib/sheetLayout.ts`; `mergeWithDefaults` automatically appends newly-added section ids to saved layouts, so adding a section id is backward-compatible. Styling: paper-document aesthetic, `cs-` classes in `src/app/globals.css` (append new rules at the end), small-caps eyebrows, hairlines, radii ≤6px, no glow/gradients on paper. Persisted updates go through `props.onUpdate(patch)` (PUT; **`JSON.stringify` drops `undefined` — send `null` or omit**).

A recent precedent to copy stylistically AND structurally: the "Effects & Conditions" section (`case "effects"` in HeroSheet, `cs-effect-*` CSS, `effects` validation case). Your feature is the same shape: a new optional array field + a new sheet section with inline add/edit/delete.

## 2. Data model

In `src/types/game.ts`:

```ts
export type PageBlock =
  | { id: string; type: "text"; content: string }
  | { id: string; type: "image"; url: string; caption?: string };

export type CharacterPage = {
  id: string;
  title: string;
  blocks: PageBlock[];
};
```

`Character.pages?: CharacterPage[]`.

Validation (new `case "pages"` in `validateCharacter.ts`, allowlist `"pages"`):
- array, ≤ 10 pages; each page: `id` string, `title` non-empty string ≤ 60, `blocks` array ≤ 20;
- text block: `content` string ≤ 5000;
- image block: `url` string ≤ 500 matching `/^https?:\/\//i` (the vault is a JSON file — **no data URLs, no uploads**; same rule as `theme.backgroundImageUrl`); `caption` ≤ 120 optional.

## 3. UI

New sheet section `"pages"` (add to `SheetSectionId`, `SECTION_TITLES: "Pages"`, end of the third column in `DEFAULT_LAYOUT`, and `MOBILE_ORDER`). Inside the section:

- **Page tab strip:** one small tab per page (title, 0.8em, hairline, active = accent underline like the sheet's ref tabs) + a `+ Page` button (prompt-less: creates "New page" and focuses its title). Local `useState` for the active page index; content persists via `onUpdate({ pages })`.
- **Title:** inline text input styled as writing on the document (borderless, hairline bottom border on focus), saves on blur/debounce.
- **Blocks, stacked vertically:**
  - text block → `<textarea>` autosizing (or generous min-height), same debounced-save pattern the sheet uses elsewhere (300ms like `saveLayout`);
  - image block → the image (`max-width: 100%`, hairline border) with the caption under it in `--ink-3`; broken URLs must not break layout (`onError` → show a muted "image unavailable" row). Below the image when editing: the URL input + caption input.
- **Add controls** at the bottom of the page: `+ Text` and `+ Image` buttons. Each block gets a small `×` remove (confirm via `window.confirm` for blocks with content) and the page header a `Delete page` (always confirm).
- Empty state: "No pages yet — add a journal, backstory, or map."
- Keep the section's inner markup on `cs-page-*` class names; reuse `cs-glass-btn`, `cs-muted`, `cs-rule-note`, `qb-name-input` where they fit.

**Note on the original request ("images or graphs"):** graphs are out of scope this round — an image URL of a chart covers it. Say so in the changelog rather than inventing a chart editor.

## 4. Constraints & landmines

1. No new dependencies. No API shape changes beyond the allowlisted `pages` field. No touching lib/data beyond `types`, `validateCharacter`, `sheetLayout`.
2. All persistence through `props.onUpdate` — one patch per logical action; debounce typing.
3. Images are `https` URLs only; enforce client-side (matching warning style of the Appearance panel's background-image field) AND server-side.
4. `globals.css` is append-ordered — new rules at the end; never define a CSS var in terms of itself.
5. The section must behave like every other section: draggable, collapsible, hideable in edit mode — you get this for free by registering the id correctly; don't special-case it.
6. Theme compatibility: use the token vars (`--parchment`, `--ink-faint`, `--rule-soft`, `--accent`) — the section must look right under dark skins (e.g. Necromancer) too.

## 5. Verification (in the running app; reuse the dev server if port 3000 is taken)

1. `npm run lint` 0 errors; `npm run build` passes.
2. On an existing character: add two pages; rename one inline; add text + image blocks (use any real https image); reload — everything persists; blocks render; a garbage URL shows the fallback, not a broken layout.
3. `PUT /api/characters/:id` with `pages: [{...url: "javascript:alert(1)"}]` → 400.11 pages → 400.
4. Drag the Pages section between columns, collapse it, hide/show it in edit mode.
5. Apply a dark skin preset and confirm readability.
6. Screenshots: section with a filled page (desktop + ~380px).

**Deliverable:** code + `docs/CHANGES-7.md` (what changed per area, what you clicked, what you observed, deviations called out). No entry = not done.
