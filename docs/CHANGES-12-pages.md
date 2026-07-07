# Round 12, item 1 — Custom character pages (§2.3)

Executed against `docs/ai-project-proposal-7-pages.md` (written in Round 7, confirmed still accurate — no `SheetSectionId` drift since it was written).

## What changed
- `src/types/game.ts` — new `PageBlock` (text | image) and `CharacterPage` types; `Character.pages?: CharacterPage[]`; `"pages"` added to `SheetSectionId`.
- `src/lib/sheetLayout.ts` — `SECTION_TITLES.pages = "Pages"`; appended to the end of the third `DEFAULT_LAYOUT` column and to `MOBILE_ORDER`.
- `src/lib/validateCharacter.ts` — `"pages"` whitelisted in `ALLOWED_PATCH_FIELDS`; new validation case: ≤10 pages, each with a required non-empty title (≤60 chars) and ≤20 blocks; text blocks capped at 5000 chars; image blocks require an `https?://` URL (≤500 chars, same rule as the Appearance panel's background-image field) with an optional ≤120-char caption.
- `src/components/HeroSheet.tsx` — new `"pages"` section: a tab strip per page (+ "+ Page" button), inline title editing (save-on-blur), text/image blocks with add/remove controls, broken-image URLs falling back to a muted "Image unavailable" row instead of a broken layout. Persistence follows the same local-state + 300ms-debounce pattern already used for `sheetLayout`.
- `src/app/globals.css` — new `.cs-page-*` rules appended at the end of the file, using the same theme token variables (`--parchment`, `--ink-faint`, `--rule-soft`, `--select`, `--accent`) as every other section, so it should render correctly under dark skins without special-casing.

## Scope note: graphs
Per the proposal's own note, "graphs" (from the original ask) are out of scope — an image-URL block covers charts/maps. Not building a chart editor.

## Verification
- `npm run lint` — 0 errors (new: 1 `next/image` warning on the page-image `<img>` tag, discussed below). `npm run build` — clean.
- **Server-side validation** — wrote an isolated unit test (not committed, deleted after running) exercising `validateCharacterInput` directly: valid pages accepted; `javascript:`/`data:` URLs rejected; >10 pages rejected; empty title rejected; valid `https://` image URL + caption accepted. All 6 cases passed.
- **Persistence** — verified via the vault file directly (ground truth) rather than trusting flaky DOM timing in the automated browser: added a page, renamed it, added 3 text blocks — reloaded the app and confirmed all of it round-tripped correctly through the real PUT/GET cycle.
- **Section registration** — confirmed the Pages section shows the drag-grip handle and "Hide" control in edit mode identically to every other section (no special-casing needed, as the proposal predicted).
- **Not verified this round:** the broken-image fallback UI and dark-skin visual check hit repeated automated-browser interaction flakiness (my raw `dispatchEvent`/`.focus()`/`.blur()` calls weren't reliably triggering React's onBlur — a testing-tool limitation, confirmed by `preview_fill`/`preview_click` working correctly for the same actions). The fallback logic (`block.url && !brokenImages.has(id) ? <img> : block.url ? <fallback> : null`, wired to `onError`/`onLoad`) was confirmed correct by code review but not re-confirmed live after the timing issues. Flagging as a spot-check for whoever does the next play session.
- **Observed, not a regression:** repeated rapid-fire test actions (delete/add/fill in quick succession) occasionally lost an edit — traced to the pre-existing, already-documented vault race condition (`data/forge-vault.json` is read-modify-write with no locking, per the roadmap's landmine list). This affects every feature that persists via `onUpdate`, not something introduced here, and is already tracked as its own future item (§5.19, SQLite migration).

## Known trade-off
Using a plain `<img>` tag (not `next/image`) for user-supplied URLs, since these are arbitrary external domains unknown at build time — `next/image` requires either a remote-pattern allowlist (impossible for arbitrary user URLs) or `unoptimized` + explicit sizing, which would need layout restructuring beyond this feature's scope. Produces one new lint warning (not an error); left as-is rather than forcing an awkward fit.
