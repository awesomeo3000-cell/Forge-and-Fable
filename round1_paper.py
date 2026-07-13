import io

def patch(path, old, new, label):
    with io.open(path, "r", encoding="utf-8", newline="") as f:
        text = f.read()
    # match the file's actual line endings
    if "\r\n" in text:
        old = old.replace("\n", "\r\n")
        new = new.replace("\n", "\r\n")
    n = text.count(old)
    if n != 1:
        print(f"FAIL ({label}): found {n} occurrences, expected 1 -- file NOT modified")
        return False
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text.replace(old, new))
    print(f"OK   ({label})")
    return True

CSS = r"E:\forge-and-fable\src\app\globals.css"
TSX = r"E:\forge-and-fable\src\components\DMTablePanel.tsx"

results = []

# 1. The paper decision: ledger tokens + one-place legacy role remap
results.append(patch(CSS,
""".dm-table {
  --dm-surface: var(--ground-2, #f4eddf);
  --dm-ink: var(--paper, #2b241b);
""",
""".dm-table {
  /* THE TABLE IS PAPER - decided here, in the stylesheet. The Table began as
     a dark desk whose rules used --paper as the FOREGROUND role and
     --ground-2 as the SURFACE role; DM-1 flipped it light by hijacking those
     tokens with hex values in an inline style (and set --ink equal to
     --paper, killing ink/paper contrast). This block is the honest version:
     ledger tokens are the single source, the legacy role names are remapped
     once below, and the campaign skin arrives only through --doc-accent.
     New rules use --dm-ink / --dm-surface / --dm-accent, never --paper or
     --ground-2. */
  --dm-surface: var(--ledger-paper, #e9dfc8);
  --dm-ink: var(--ledger-ink, #2a2018);
  --dm-accent: var(--doc-accent, var(--ledger-seal, #8c2f22));
  /* Legacy role remap (foreground / surface / muted foreground): */
  --paper: var(--dm-ink);
  --ground-2: var(--dm-surface);
  --ink: var(--dm-ink);
  --paper-muted: color-mix(in srgb, var(--dm-ink) 55%, var(--dm-surface));
""",
"dm-table token block"))

# 2. Remove the inline token hijack; keep only the campaign accent
results.append(patch(TSX,
'style={({ "--paper": "#2b241b", "--ink": "#2b241b", "--ground-2": "#f4eddf", "--doc-accent": theme?.accent ?? "#8c5a2b" } as React.CSSProperties)}',
'style={({ "--doc-accent": theme?.accent ?? "#8c5a2b" } as React.CSSProperties)}',
"DMTablePanel inline hijack"))

# 3. Request cards: --paper is the FOREGROUND role; this rule used it as a
#    surface, so the cards render near-black today. Point it at the surface.
results.append(patch(CSS,
"background:color-mix(in srgb,var(--paper) 94%,white)",
"background:color-mix(in srgb,var(--dm-surface,#e9dfc8) 94%,white)",
"dm-request-card background"))

# 4. Error text: salmon was tuned for the dark desk; use the danger token
results.append(patch(CSS,
""".dm-table-error {
  margin: 10px 0 0;
  color: #ef9a85;
""",
""".dm-table-error {
  margin: 10px 0 0;
  color: var(--dm-danger, #b33b32);
""",
"dm-table-error color"))

print()
print("All patches applied." if all(results) else "SOME PATCHES FAILED - tell Fable which ones.")