# -*- coding: utf-8 -*-
import io
PANEL = r"E:\forge-and-fable\src\components\DMTablePanel.tsx"
with io.open(PANEL, "r", encoding="utf-8", newline="") as f:
    lines = f.read().splitlines(keepends=True)
idx = next((i for i, l in enumerate(lines) if "dm-rehearsal-control" in l and "className" in l), None)
if idx is None:
    print("FAIL: marker not found")
elif "Test the table" in lines[idx+1] and "Seat 4 ghosts" in lines[idx+2] and "</div>" in lines[idx+3]:
    del lines[idx:idx+4]
    with io.open(PANEL, "w", encoding="utf-8", newline="") as f:
        f.write("".join(lines))
    print("OK: header rehearsal control removed")
else:
    print("FAIL: block shape unexpected -- lines:", [lines[idx+n].strip()[:60] for n in range(4)])