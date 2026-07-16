"""Build the site's drop-in portrait catalog from assets/portraits/.

The command preserves source aspect ratios, creates lightweight 512px WebP
assets, detects painted circular frames when present, and writes the TypeScript
catalog consumed by the character builder.
"""

from __future__ import annotations

import hashlib
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError
except ImportError:
    print("Portrait sync needs Pillow. Install it with: python -m pip install Pillow", file=sys.stderr)
    raise SystemExit(1)


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "portraits"
OUTPUT_DIR = ROOT / "public" / "portraits" / "drop-ins"
CATALOG_PATH = ROOT / "src" / "data" / "portraits.generated.ts"
OUTPUT_SIZE = 512
DETECT_SIZE = 256
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# These match the species currently understood by the app. Put an image in a
# matching subfolder or begin its filename with the species to make it appear
# in the portrait selector's Suggested tab.
ANCESTRIES = (
    "half-elf",
    "dragonborn",
    "halfling",
    "tiefling",
    "aasimar",
    "genasi",
    "goliath",
    "dwarf",
    "gnome",
    "human",
    "elf",
    "orc",
)


@dataclass(frozen=True)
class PortraitEntry:
    portrait_id: str
    src: str
    ancestries: tuple[str, ...]
    frame: tuple[int, int, int] | None


def slugify(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")
    return slug or "portrait"


def infer_ancestries(relative_path: Path) -> tuple[str, ...]:
    parts = [slugify(part) for part in relative_path.with_suffix("").parts]
    for ancestry in ANCESTRIES:
        aliases = {ancestry, ancestry.replace("-", "")}
        for part in parts:
            if any(part == alias or part.startswith(f"{alias}-") for alias in aliases):
                return (ancestry,)
    return ()


def stable_names(relative_path: Path) -> tuple[str, str]:
    relative_key = relative_path.as_posix().lower()
    digest = hashlib.sha1(relative_key.encode("utf-8")).hexdigest()[:8]
    path_slug = slugify("-".join(relative_path.with_suffix("").parts))[:64].rstrip("-")
    return f"portrait-auto-{path_slug}-{digest}", f"{path_slug}-{digest}.webp"


def corner_background(pixels, width: int, height: int) -> tuple[float, float, float]:
    sample_size = max(2, min(6, width // 8, height // 8))
    samples: list[tuple[int, int, int]] = []
    for offset_x, offset_y in (
        (0, 0),
        (width - sample_size, 0),
        (0, height - sample_size),
        (width - sample_size, height - sample_size),
    ):
        for x in range(offset_x, offset_x + sample_size):
            for y in range(offset_y, offset_y + sample_size):
                samples.append(pixels[x, y])
    count = len(samples)
    return tuple(sum(color[channel] for color in samples) / count for channel in range(3))


def detect_painted_circle(image: Image.Image) -> tuple[float, float, float] | None:
    """Return a circle in source coordinates, or None for ordinary full-bleed art."""
    small = image.convert("RGB")
    small.thumbnail((DETECT_SIZE, DETECT_SIZE), Image.Resampling.LANCZOS)
    width, height = small.size
    pixels = small.load()
    background = corner_background(pixels, width, height)
    columns = [0] * width
    rows = [0] * height
    changed_pixels = 0

    for y in range(height):
        for x in range(width):
            red, green, blue = pixels[x, y]
            distance = (
                (red - background[0]) ** 2
                + (green - background[1]) ** 2
                + (blue - background[2]) ** 2
            ) ** 0.5
            if distance > 28:
                columns[x] += 1
                rows[y] += 1
                changed_pixels += 1

    minimum_line_pixels = max(3, round(min(width, height) * 0.015))
    xs = [index for index, count in enumerate(columns) if count >= minimum_line_pixels]
    ys = [index for index, count in enumerate(rows) if count >= minimum_line_pixels]
    if not xs or not ys or changed_pixels < width * height * 0.08:
        return None

    x0, x1, y0, y1 = xs[0], xs[-1], ys[0], ys[-1]
    box_width = x1 - x0 + 1
    box_height = y1 - y0 + 1

    # Full-bleed artwork reaches the edge; only apply special framing when a
    # distinct, roughly circular painted area sits within a background sheet.
    edge_margin = max(2, round(min(width, height) * 0.015))
    touches_edge = (
        x0 <= edge_margin
        or y0 <= edge_margin
        or x1 >= width - edge_margin - 1
        or y1 >= height - edge_margin - 1
    )
    aspect = box_width / box_height
    if touches_edge or not 0.82 <= aspect <= 1.18:
        return None

    source_width, source_height = image.size
    scale_x = source_width / width
    scale_y = source_height / height
    center_x = ((x0 + x1 + 1) / 2) * scale_x
    center_y = ((y0 + y1 + 1) / 2) * scale_y
    radius = max(box_width * scale_x, box_height * scale_y) / 2
    return center_x, center_y, radius


def make_square(image: Image.Image) -> tuple[Image.Image, tuple[float, float, float]]:
    """Fit without distortion and use a soft fill instead of hard letterboxing."""
    rgb = image.convert("RGB")
    backdrop = ImageOps.fit(rgb, (OUTPUT_SIZE, OUTPUT_SIZE), method=Image.Resampling.LANCZOS)
    backdrop = backdrop.filter(ImageFilter.GaussianBlur(radius=24))
    foreground = ImageOps.contain(rgb, (OUTPUT_SIZE, OUTPUT_SIZE), method=Image.Resampling.LANCZOS)
    offset_x = (OUTPUT_SIZE - foreground.width) // 2
    offset_y = (OUTPUT_SIZE - foreground.height) // 2
    backdrop.paste(foreground, (offset_x, offset_y))
    scale = min(OUTPUT_SIZE / rgb.width, OUTPUT_SIZE / rgb.height)
    return backdrop, (scale, float(offset_x), float(offset_y))


def map_frame_to_square(
    frame: tuple[float, float, float] | None,
    placement: tuple[float, float, float],
) -> tuple[int, int, int] | None:
    if frame is None:
        return None
    center_x, center_y, radius = frame
    scale, offset_x, offset_y = placement
    mapped_radius = min(round(radius * scale), 243)
    if mapped_radius < 48:
        return None
    return (
        round(center_x * scale + offset_x),
        round(center_y * scale + offset_y),
        mapped_radius,
    )


def render_catalog(entries: list[PortraitEntry]) -> str:
    lines = [
        'import type { PortraitOption } from "./portraits";',
        "",
        "/**",
        " * Generated by `npm run portraits:sync`.",
        " * Drop source images into assets/portraits/; do not edit this file by hand.",
        " */",
        "export const GENERATED_PORTRAITS: readonly PortraitOption[] = [",
    ]
    for entry in entries:
        ancestry_text = ", ".join(f'"{ancestry}"' for ancestry in entry.ancestries)
        frame_text = ""
        if entry.frame:
            center_x, center_y, radius = entry.frame
            frame_text = f", frame: {{ cx: {center_x}, cy: {center_y}, r: {radius} }}"
        lines.append(
            f'  {{ id: "{entry.portrait_id}", src: "{entry.src}", '
            f"suggestedAncestries: [{ancestry_text}]{frame_text} }},"
        )
    lines.extend(["];", ""])
    return "\n".join(lines)


def main() -> int:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source_images = sorted(
        (
            path
            for path in SOURCE_DIR.rglob("*")
            if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
        ),
        key=lambda path: path.relative_to(SOURCE_DIR).as_posix().lower(),
    )

    entries: list[PortraitEntry] = []
    errors: list[str] = []
    for source_path in source_images:
        relative_path = source_path.relative_to(SOURCE_DIR)
        portrait_id, output_name = stable_names(relative_path)
        output_path = OUTPUT_DIR / output_name
        try:
            with Image.open(source_path) as opened:
                image = ImageOps.exif_transpose(opened)
                detected_frame = detect_painted_circle(image)
                output_image, placement = make_square(image)
                output_image.save(output_path, "WEBP", quality=90, method=6)
                frame = map_frame_to_square(detected_frame, placement)
        except (OSError, ValueError, UnidentifiedImageError) as error:
            errors.append(f"{relative_path}: {error}")
            continue

        entries.append(
            PortraitEntry(
                portrait_id=portrait_id,
                src=f"/portraits/drop-ins/{output_name}",
                ancestries=infer_ancestries(relative_path),
                frame=frame,
            )
        )

    if errors:
        print("Portrait sync stopped because some files could not be processed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    CATALOG_PATH.write_text(render_catalog(entries), encoding="utf-8", newline="\n")
    print(f"Synced {len(entries)} portrait{'s' if len(entries) != 1 else ''}.")
    if entries:
        tagged = sum(bool(entry.ancestries) for entry in entries)
        print(f"Suggested-tab ancestry detected for {tagged}/{len(entries)} portraits.")
    print(f"Drop folder: {SOURCE_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
