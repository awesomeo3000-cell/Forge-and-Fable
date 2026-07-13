"""One-off import: resize new portrait art from assets/ into public/portraits/
and report the painted-circle frame for each (scaled to the 512px catalog size)."""
from PIL import Image
import os

SRC = r"E:\forge-and-fable\assets"
DST = r"E:\forge-and-fable\public\portraits"
OUT_SIZE = 512

MAPPING = {
    "ChatGPT Image Jul 13, 2026, 01_10_24 PM (1).png": "aasimar-male.png",
    "ChatGPT Image Jul 13, 2026, 01_10_24 PM (2).png": "tiefling-female.png",
    "ChatGPT Image Jul 13, 2026, 01_10_24 PM (3).png": "genasi-male.png",
    "ChatGPT Image Jul 13, 2026, 01_10_25 PM (4).png": "aasimar-female.png",
    "ChatGPT Image Jul 13, 2026, 01_10_25 PM (5).png": "goliath-male.png",
    "ChatGPT Image Jul 13, 2026, 01_10_25 PM (6).png": "goliath-female.png",
    "ChatGPT Image Jul 13, 2026, 01_10_25 PM (7).png": "tiefling-male.png",
    "femalegenasi.png": "genasi-female.png",
    "humanfemale.png": "human-female.png",
    "humanmale.png": "human-male.png",
}

DETECT = 256  # detection resolution

def corner_bg(px, size):
    samples = []
    for ox, oy in [(0, 0), (size - 8, 0), (0, size - 8), (size - 8, size - 8)]:
        for x in range(ox, ox + 8):
            for y in range(oy, oy + 8):
                samples.append(px[x, y])
    n = len(samples)
    return tuple(sum(c[i] for c in samples) / n for i in range(3))

def detect_circle(img):
    small = img.convert("RGB").resize((DETECT, DETECT), Image.BILINEAR)
    px = small.load()
    bg = corner_bg(px, DETECT)
    thresh = 25.0
    cols = [0] * DETECT
    rows = [0] * DETECT
    for y in range(DETECT):
        for x in range(DETECT):
            r, g, b = px[x, y]
            d = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            if d > thresh:
                cols[x] += 1
                rows[y] += 1
    minc = 3  # ignore stray noise
    xs = [i for i, v in enumerate(cols) if v >= minc]
    ys = [i for i, v in enumerate(rows) if v >= minc]
    if not xs or not ys:
        return None
    x0, x1, y0, y1 = xs[0], xs[-1], ys[0], ys[-1]
    scale = OUT_SIZE / DETECT
    cx = (x0 + x1 + 1) / 2 * scale
    cy = (y0 + y1 + 1) / 2 * scale
    r = max(x1 - x0 + 1, y1 - y0 + 1) / 2 * scale
    return round(cx), round(cy), round(r)

for src_name, dst_name in MAPPING.items():
    path = os.path.join(SRC, src_name)
    img = Image.open(path)
    w, h = img.size
    circle = detect_circle(img)
    out = img.convert("RGB").resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
    out.save(os.path.join(DST, dst_name), optimize=True)
    kb = os.path.getsize(os.path.join(DST, dst_name)) // 1024
    if circle:
        cx, cy, r = circle
        frac = r / OUT_SIZE
        print(f"{dst_name}: {w}x{h} -> 512, frame cx={cx} cy={cy} r={r} (r/size={frac:.2f}), {kb}KB")
    else:
        print(f"{dst_name}: {w}x{h} -> 512, CIRCLE NOT DETECTED, {kb}KB")
