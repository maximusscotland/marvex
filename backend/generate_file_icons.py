"""
One-shot file-type icon generator for Marvex Studio.

Generates two document-silhouette icons (one for `.mmap`, one for `.mmlib`)
via Gemini Nano Banana, then transcodes each to both `.ico` (Windows) and
`.icns` (macOS) so electron-builder can register them in `fileAssociations`.

Outputs:
    /app/desktop/build/file-icon-mmap.png    (1024×1024 master)
    /app/desktop/build/file-icon-mmap.ico    (multi-res Windows)
    /app/desktop/build/file-icon-mmap.icns   (macOS)
    /app/desktop/build/file-icon-mmlib.png
    /app/desktop/build/file-icon-mmlib.ico
    /app/desktop/build/file-icon-mmlib.icns

Usage:
    cd /app/backend && python generate_file_icons.py
"""
import asyncio
import base64
import io
import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from PIL import Image

load_dotenv(Path(__file__).parent / ".env")
API_KEY = os.environ["EMERGENT_LLM_KEY"]
OUT_DIR = Path("/app/desktop/build")
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "gemini-3.1-flash-image-preview"

# Shared style — file icons must read clearly at 16×16 in Explorer/Finder,
# so we keep silhouettes bold and accents minimal.
STYLE = (
    " Flat document-shape silhouette with a subtle folded top-right corner, "
    "centered on a transparent-look deep navy void (#030714). Bold readable "
    "outline, neon cyan (#00F0FF) and electric violet (#7A3BFF) accents only, "
    "no text, no letters, no words, no logos. Clean vector silhouette, soft "
    "inner glow, symmetrical composition, square format 1024×1024, designed "
    "to remain legible at 16×16 down to 1024×1024."
)

ICONS = {
    "file-icon-mmap": (
        "A glowing cosmic document file icon: portrait-orientation page shape "
        "filling 80% of the canvas, with a small radial mind-map motif INSIDE "
        "the document — one glowing cyan central node connected to four "
        "smaller violet satellite nodes by thin neon lines. The page outline "
        "is a soft cyan stroke, the folded top-right corner shows a tiny "
        "violet highlight."
    ),
    "file-icon-mmlib": (
        "A glowing cosmic library archive document icon: portrait-orientation "
        "page shape filling 80% of the canvas, with three stacked horizontal "
        "spine lines INSIDE the document representing books on a shelf, each "
        "spine ending in a small star-dot. Cyan top spine, violet middle "
        "spine, cyan bottom spine. The page outline is a soft violet stroke, "
        "the folded top-right corner shows a tiny cyan highlight."
    ),
}

# ICO sizes — Windows Explorer + taskbar render the smallest available match,
# so we ship the full ladder.
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
# ICNS sizes — macOS picks based on Retina + view; this is the standard set.
ICNS_SIZES = [(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)]


async def generate_one(name: str, prompt: str) -> bool:
    full_prompt = f"{prompt}{STYLE}"
    chat = (
        LlmChat(
            api_key=API_KEY,
            session_id=f"file-icon-{uuid.uuid4().hex[:8]}",
            system_message="You are a world-class icon designer. Output images only.",
        )
        .with_model("gemini", MODEL)
        .with_params(modalities=["image", "text"])
    )

    try:
        _, images = await chat.send_message_multimodal_response(
            UserMessage(text=full_prompt)
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[{name}] generation error: {exc}")
        return False

    if not images:
        print(f"[{name}] no image returned")
        return False

    raw = base64.b64decode(images[0]["data"])
    png_path = OUT_DIR / f"{name}.png"
    png_path.write_bytes(raw)
    print(f"[{name}] saved master {png_path} ({len(raw) // 1024} KB)")

    # Transcode to ICO + ICNS so electron-builder doesn't have to.
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    # Pad / square-fit (Nano Banana sometimes returns slightly off-square).
    if img.size[0] != img.size[1]:
        side = max(img.size)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2))
        img = canvas

    ico_path = OUT_DIR / f"{name}.ico"
    img.save(ico_path, format="ICO", sizes=ICO_SIZES)
    print(f"[{name}] wrote {ico_path}")

    icns_path = OUT_DIR / f"{name}.icns"
    # Pillow's ICNS writer expects sizes that are powers of 2 between 16 and 1024.
    img.save(icns_path, format="ICNS", sizes=ICNS_SIZES)
    print(f"[{name}] wrote {icns_path}")

    return True


async def main() -> int:
    results = await asyncio.gather(*[generate_one(n, p) for n, p in ICONS.items()])
    ok = sum(1 for r in results if r)
    print(f"\n{ok}/{len(ICONS)} file-type icons generated")
    return 0 if ok == len(ICONS) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
