#!/usr/bin/env python3
"""
generate_app_icons.py — build the cross-platform icon set that
electron-builder packs into the Marvex Studio installers.

Source: build/source.jpeg (the canonical 1024×1024 "M" mark).
Outputs (all in /app/desktop/build/):
  icon.png      1024×1024 — read by macOS + Linux configs in
                electron-builder.yml.  electron-builder auto-derives
                multi-res .icns + Linux iconography from this.
  icon.ico      multi-resolution Windows icon (16/24/32/48/64/128/256
                px frames in one file) — picked up by win.icon in
                electron-builder.yml.
  icon.icns     fallback macOS icon for tooling that doesn't accept .png
                (some prebuilt CI bakes complain otherwise).  Optional
                belt-and-braces: electron-builder generates this itself
                from icon.png on macOS runners, but having it in the
                tree means non-macOS contributors can also `yarn dist:mac`
                and produce a fully-iconned .dmg.

The script is idempotent and runs in < 2 s.  Re-run any time the source
mark changes by dropping a new 1024×1024 source.jpeg into build/.

Usage:
    cd /app/desktop/build && python3 generate_app_icons.py
"""
from __future__ import annotations

import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source.jpeg"
PNG_OUT = ROOT / "icon.png"
ICO_OUT = ROOT / "icon.ico"
ICNS_OUT = ROOT / "icon.icns"


def load_source() -> Image.Image:
    if not SOURCE.exists():
        sys.exit(f"Source image not found: {SOURCE}\n"
                 "Drop a 1024×1024 PNG/JPEG at that path and re-run.")
    img = Image.open(SOURCE).convert("RGBA")
    # Pad/crop to a perfect square if the source isn't already.
    w, h = img.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
    if img.size != (1024, 1024):
        img = img.resize((1024, 1024), Image.LANCZOS)
    return img


def write_png(src: Image.Image) -> None:
    """Master high-res PNG for macOS + Linux + fallbacks."""
    src.save(PNG_OUT, "PNG", optimize=True)
    print(f"  → {PNG_OUT.name} ({PNG_OUT.stat().st_size // 1024} KB, 1024×1024)")


def write_ico(src: Image.Image) -> None:
    """Multi-resolution Windows .ico.

    Pillow's built-in .ico writer accepts a `sizes=` kwarg that bakes
    all the requested resolutions into one file. We include every size
    Windows ever consults (Explorer thumbnails, taskbar, Alt-Tab,
    NSIS installer chrome, file-type icons in folders, etc.)."""
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64),
             (128, 128), (256, 256)]
    src.save(ICO_OUT, format="ICO", sizes=sizes)
    print(f"  → {ICO_OUT.name} ({ICO_OUT.stat().st_size // 1024} KB, {len(sizes)} resolutions)")


# --------- minimal pure-Python .icns writer ---------
# Apple's icns format: 8-byte header ("icns" + big-endian total length)
# followed by a sequence of "icon entries" — each is a 4-byte type code,
# 4-byte length, then payload.  For our needs we just need to encode a
# few PNG payloads with the modern type codes (ic07-ic10 = PNG icons).
# Reference: https://en.wikipedia.org/wiki/Apple_Icon_Image_format
_ICNS_PNG_TYPES = [
    ("ic07", 128),    # 128×128
    ("ic08", 256),    # 256×256
    ("ic09", 512),    # 512×512
    ("ic10", 1024),   # 1024×1024 retina
    ("ic11", 32),     # 32×32   @2x
    ("ic12", 64),     # 64×64   @2x
    ("ic13", 256),    # 256×256 @2x (same as ic08 in raw px)
    ("ic14", 512),    # 512×512 @2x (same as ic09 in raw px)
]


def write_icns(src: Image.Image) -> None:
    import io

    entries: list[bytes] = []
    for type_code, size in _ICNS_PNG_TYPES:
        resized = src.resize((size, size), Image.LANCZOS)
        buf = io.BytesIO()
        resized.save(buf, "PNG", optimize=True)
        payload = buf.getvalue()
        # Each entry header: 4-byte type, 4-byte (header + payload length)
        entry = type_code.encode("ascii") + struct.pack(">I", 8 + len(payload)) + payload
        entries.append(entry)

    body = b"".join(entries)
    header = b"icns" + struct.pack(">I", 8 + len(body))
    ICNS_OUT.write_bytes(header + body)
    print(f"  → {ICNS_OUT.name} ({ICNS_OUT.stat().st_size // 1024} KB, "
          f"{len(_ICNS_PNG_TYPES)} embedded sizes)")


def main() -> int:
    src = load_source()
    print(f"Source: {SOURCE.name} → {src.size}")
    write_png(src)
    write_ico(src)
    write_icns(src)
    print("✓ Done — electron-builder will now find icon.png / icon.ico / icon.icns.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
