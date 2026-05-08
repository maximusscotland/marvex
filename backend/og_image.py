"""
Server-side rendering of /share/:slug unfurl cards.

Pillow + cairosvg renderer — we draw a stylised card with the map title,
branch count, brand footer AND a rendering of the actual map's top-level
structure (root + L1 branches) so every share link has a unique, recognisable
preview instead of a generic icon.
"""
from __future__ import annotations

import io
import math
import os
from typing import Optional, Dict, Any, List

import cairosvg
from PIL import Image, ImageDraw, ImageFont

CARD_W, CARD_H = 1200, 630
BRAND = "marvex.app"
TAGLINE = "Turn any PDF into a mind-map"

# Try to use a bundled font; fall back to PIL default if unavailable.
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
]


def _load_font(size: int, bold: bool = True):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:  # noqa: BLE001
                continue
    # Tiny bitmap fallback — ugly but never fails.
    return ImageFont.load_default()


def _radial_gradient_bg(img: Image.Image):
    """Paint a cool cosmic radial-ish gradient by stacking concentric circles."""
    draw = ImageDraw.Draw(img, "RGB")
    draw.rectangle([0, 0, CARD_W, CARD_H], fill=(3, 4, 10))
    cx, cy = int(CARD_W * 0.3), int(CARD_H * 0.4)
    # Lighten the core.
    for r in range(900, 40, -40):
        t = (900 - r) / 860  # 0 → 1 as we approach centre
        base = (3, 4, 10)
        hi = (10, 20, 40)
        color = tuple(int(base[i] + (hi[i] - base[i]) * t) for i in range(3))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)


def _starfield(draw: ImageDraw.ImageDraw, count: int = 55):
    """Add a sparse cyan speckle to give the card texture."""
    import random
    rng = random.Random(7)  # deterministic speckles per run
    for _ in range(count):
        x = rng.randint(0, CARD_W)
        y = rng.randint(0, CARD_H)
        alpha = rng.randint(20, 80)
        draw.rectangle([x, y, x + 1, y + 1], fill=(0, 240, 255, alpha))


def _esc(s: str) -> str:
    """Minimal XML-attribute escape for user-supplied strings."""
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _build_real_map_svg(map_doc: Dict[str, Any], width: int = 560, height: int = 440) -> str:
    """
    Build a compact SVG rendering of the map's root + top-level branches.
    Deep nesting is skipped — at OG scale (~460px wide after margins) only
    L0+L1 is legible. That also keeps the render well under 10KB.
    """
    root_title = (map_doc.get("title") or "Mind-Map").strip()[:50]
    children: List[Dict[str, Any]] = (map_doc.get("children") or [])[:8]  # cap at 8 for visual balance

    cx, cy = width // 2, height // 2
    root_w, root_h = 200, 56
    node_w, node_h = 150, 44
    radius = 160

    ACCENT = "#00f0ff"
    ROOT_FILL = "rgba(3,20,36,0.95)"
    NODE_FILL = "rgba(3,14,28,0.95)"

    parts: List[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
        # Edges first (under nodes)
    ]

    # Compute child positions
    n = len(children)
    positions: List[tuple] = []
    for i, child in enumerate(children):
        angle = (2 * math.pi * i / max(1, n)) - math.pi / 2
        x = cx + math.cos(angle) * radius
        y = cy + math.sin(angle) * radius
        positions.append((x, y))
        # Edge
        parts.append(
            f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="{ACCENT}" stroke-width="1.5" stroke-opacity="0.65"/>'
        )

    # Root (drawn after edges so it sits on top of them)
    parts.append(
        f'<rect x="{cx - root_w // 2}" y="{cy - root_h // 2}" width="{root_w}" height="{root_h}" rx="8" '
        f'fill="{ROOT_FILL}" stroke="{ACCENT}" stroke-width="2"/>'
    )
    parts.append(
        f'<text x="{cx}" y="{cy + 5}" text-anchor="middle" fill="#ffffff" '
        f'font-family="DejaVu Sans, Arial, sans-serif" font-size="15" font-weight="700">'
        f'{_esc(root_title)}</text>'
    )

    # Child nodes
    for (x, y), child in zip(positions, children):
        label = _esc((child.get("title") or "").strip()[:26])
        parts.append(
            f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{node_w // 2}" ry="{node_h // 2}" '
            f'fill="{NODE_FILL}" stroke="{ACCENT}" stroke-width="1.5" stroke-opacity="0.8"/>'
        )
        parts.append(
            f'<text x="{x:.1f}" y="{y + 4:.1f}" text-anchor="middle" fill="#cfdaf3" '
            f'font-family="DejaVu Sans, Arial, sans-serif" font-size="11">{label}</text>'
        )

    parts.append("</svg>")
    return "".join(parts)


def _render_real_map_png(map_doc: Dict[str, Any], width: int, height: int) -> Optional[Image.Image]:
    """Render the real map into a transparent-background PNG of the given size."""
    try:
        svg = _build_real_map_svg(map_doc, width=width, height=height)
        png_bytes = cairosvg.svg2png(
            bytestring=svg.encode("utf-8"),
            output_width=width,
            output_height=height,
        )
        return Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        return None



def _wrap(text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    """Simple word-wrap for the title."""
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = f"{cur} {w}".strip()
        tw = font.getlength(trial) if hasattr(font, "getlength") else font.getsize(trial)[0]
        if tw <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def render_og_png(
    title: str,
    branch_count: int = 0,
    view_count: int = 0,
    author: Optional[str] = None,
    map_doc: Optional[Dict[str, Any]] = None,
) -> bytes:
    """Return PNG bytes for a 1200×630 unfurl card."""
    # Background image (RGB); overlay draw surface uses RGBA for speckles.
    bg = Image.new("RGB", (CARD_W, CARD_H), (3, 4, 10))
    _radial_gradient_bg(bg)

    overlay = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay, "RGBA")
    _starfield(odraw)

    img = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img, "RGBA")

    # --- Real map render on the right ---
    # If cairosvg successfully renders the actual map tree, use that.
    # Otherwise we silently omit the right-side preview — the card still
    # carries the title + brand footer.
    map_img = None
    if map_doc:
        map_img = _render_real_map_png(map_doc, width=560, height=440)
    if map_img is not None:
        # Paste centred on the right half.
        img.paste(map_img, (CARD_W - 560 - 40, 110), map_img)

    # --- Title (left column) ---
    title_font = _load_font(58, bold=True)
    title_text = (title or "Mind-Map").strip()[:120]
    lines = _wrap(title_text, title_font, max_w=int(CARD_W * 0.55))
    lines = lines[:3]  # cap at 3 visual lines
    y = 120
    for line in lines:
        draw.text((60, y), line, font=title_font, fill=(255, 255, 255))
        y += 68

    # --- Sub-line: "N branches · M views" ---
    sub_font = _load_font(22, bold=False)
    parts: list[str] = []
    if branch_count:
        parts.append(f"{branch_count} branch{'es' if branch_count != 1 else ''}")
    if view_count:
        parts.append(f"{view_count:,} view{'s' if view_count != 1 else ''}")
    if author:
        parts.append(f"by {author}")
    subline = " · ".join(parts) if parts else "A mind-map"
    draw.text((60, y + 12), subline, font=sub_font, fill=(154, 167, 199))

    # --- Kicker badge at top-left ---
    badge_font = _load_font(16, bold=True)
    badge_text = "READ-ONLY MIND-MAP"
    badge_w = int(
        badge_font.getlength(badge_text) if hasattr(badge_font, "getlength") else badge_font.getsize(badge_text)[0]
    )
    bx, by = 60, 60
    draw.rounded_rectangle(
        [bx, by, bx + badge_w + 32, by + 36],
        radius=18, fill=(0, 240, 255, 28), outline=(0, 240, 255, 100), width=1,
    )
    draw.text((bx + 16, by + 8), badge_text, font=badge_font, fill=(0, 240, 255))

    # --- Brand footer ---
    footer_y = CARD_H - 82
    draw.rectangle([0, footer_y, CARD_W, CARD_H], fill=(4, 6, 13))
    draw.rectangle([0, footer_y, CARD_W, footer_y + 2], fill=(0, 240, 255))
    # Cyan dot
    draw.ellipse([45, footer_y + 28, 67, footer_y + 50], fill=(0, 240, 255))
    # Brand text
    brand_font = _load_font(24, bold=True)
    draw.text((80, footer_y + 22), BRAND, font=brand_font, fill=(255, 255, 255))
    brand_w = int(
        brand_font.getlength(BRAND) if hasattr(brand_font, "getlength") else brand_font.getsize(BRAND)[0]
    )
    tag_font = _load_font(16, bold=False)
    draw.text((80 + brand_w + 16, footer_y + 32), TAGLINE, font=tag_font, fill=(154, 167, 199))

    # --- Output ---
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _count_branches(map_doc: dict) -> int:
    """Count only the top-level branches — that's what the stylised render shows."""
    return len((map_doc or {}).get("children") or [])
