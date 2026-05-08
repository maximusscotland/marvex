"""
Per-page Open Graph card generator for Marvex Studio.

Generates 3 page-specific OG cards (1200×630) that visually communicate
the page's intent at thumbnail size, since social-share viewers see the
image first and the title second.

Each card is intentionally text-light — the page title comes through
the og:title meta tag, so the image just sets visual context. We avoid
generated typography because Nano Banana frequently misspells brand
names; vector glyph elements (icons, arrows, badges) read clearly
without that risk.

Outputs:
  /app/frontend/public/og/pdf-to-mind-map.png   (the conversion arrow)
  /app/frontend/public/og/pricing.png           (4-tier pricing pillars)
  /app/frontend/public/og/vs.png                (split-screen comparison)

Usage: cd /app/backend && python generate_og_pages.py
"""
import asyncio
import base64
import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from PIL import Image

load_dotenv(Path(__file__).parent / ".env")
API_KEY = os.environ["EMERGENT_LLM_KEY"]
OUT_DIR = Path("/app/frontend/public/og")
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "gemini-3.1-flash-image-preview"

SHARED_STYLE = (
    " Deep navy void background (#030714) with subtle violet→cyan gradient "
    "depth and tasteful star/particle field. Premium SaaS aesthetic, "
    "clean vector silhouettes, neon cyan (#00F0FF) and electric violet "
    "(#7A3BFF) accents only. Tasteful film-grain noise overlay. NO TEXT, "
    "NO LETTERS, NO WORDS, NO LOGOS — title is overlaid via meta tags. "
    "Composition leaves balanced negative space top and bottom for "
    "platform UI chrome. Centred and balanced, highly legible at "
    "thumbnail size, exact 16:9 wide aspect."
)

CARDS = {
    "pdf-to-mind-map": (
        "An OG social card visually depicting 'PDF → Mind Map' "
        "transformation. LEFT THIRD: a stylised PDF document silhouette "
        "with cyan stroke and small horizontal text-line marks (no actual "
        "letters). MIDDLE: a glowing neon-cyan arrow with sparkle/AI dust "
        "particles flowing from left to right, conveying transformation. "
        "RIGHT TWO-THIRDS: a beautiful radial mind-map with one central "
        "neon-cyan node and 7 progressively smaller violet satellite "
        "nodes spreading outward in a tree pattern, connected by thin "
        "glowing lines. The transformation arrow visually 'becomes' the "
        "mind map's central node."
    ),
    "pricing": (
        "An OG social card depicting four pricing pillars side by side. "
        "Four glowing translucent vertical pillars/columns at progressive "
        "heights from left to right (smallest, small, medium, tallest). "
        "Pillar 1 (smallest, free): plain cyan outline. Pillar 2 (Lite): "
        "single small cyan diamond near the top. Pillar 3 (Pro): two "
        "stacked violet diamonds. Pillar 4 (tallest, Founder Lifetime): "
        "a brilliant glowing star/sparkle crown radiating cyan-violet "
        "rays. Pillars sit on a faint cosmic horizon line. Premium, "
        "luxurious, conveys 'tiers' and 'choice' without any letters."
    ),
    "vs": (
        "An OG social card depicting a split-screen visual comparison. "
        "LEFT HALF: a cluttered tangle of grey/dim small geometric shapes "
        "and crossed-out connector lines (representing 'the competition' "
        "or 'old way' — feels disorganised and dim). VERTICAL DIVIDER: "
        "a thin glowing neon-cyan vertical bar with a subtle vs symbol "
        "(an X-shape made of two glowing strokes, NO letters). RIGHT "
        "HALF: a clean, glowing, beautifully-organised radial mind-map "
        "with 5 nodes radiating from a bright central neon-cyan core "
        "(representing Marvex Studio — feels organised and luminous). "
        "The contrast between the two halves should be unmistakable."
    ),
}

TARGET_W, TARGET_H = 1200, 630


def normalise(img: Image.Image) -> Image.Image:
    """Crop or pad to exact 1200×630 — Nano Banana sometimes returns
    1024×1024 or off-spec dimensions, so we always normalise."""
    target_aspect = TARGET_W / TARGET_H
    img_aspect = img.width / img.height
    if abs(img_aspect - target_aspect) < 0.02:
        return img.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    if img_aspect > target_aspect:
        new_w = int(img.height * target_aspect)
        left = (img.width - new_w) // 2
        return img.crop((left, 0, left + new_w, img.height)).resize((TARGET_W, TARGET_H), Image.LANCZOS)
    new_h = int(img.width / target_aspect)
    top = (img.height - new_h) // 2
    return img.crop((0, top, img.width, top + new_h)).resize((TARGET_W, TARGET_H), Image.LANCZOS)


async def generate_one(name: str, prompt: str) -> bool:
    full_prompt = f"{prompt}{SHARED_STYLE}"
    chat = (
        LlmChat(
            api_key=API_KEY,
            session_id=f"og-{name}-{uuid.uuid4().hex[:8]}",
            system_message="You are a world-class brand designer. Output images only.",
        )
        .with_model("gemini", MODEL)
        .with_params(modalities=["image", "text"])
    )

    try:
        _, images = await chat.send_message_multimodal_response(
            UserMessage(text=full_prompt)
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[{name}] error: {exc}")
        return False

    if not images:
        print(f"[{name}] no image returned")
        return False

    raw = base64.b64decode(images[0]["data"])
    img = normalise(Image.open(__import__("io").BytesIO(raw)).convert("RGB"))

    out_png = OUT_DIR / f"{name}.png"
    img.save(out_png, format="PNG", optimize=True)
    print(f"[{name}] wrote {out_png} ({os.path.getsize(out_png) // 1024} KB)")

    out_webp = OUT_DIR / f"{name}.webp"
    img.save(out_webp, format="WEBP", quality=88, method=6)
    print(f"[{name}] wrote {out_webp} ({os.path.getsize(out_webp) // 1024} KB)")
    return True


async def main() -> int:
    results = await asyncio.gather(*[generate_one(n, p) for n, p in CARDS.items()])
    ok = sum(1 for r in results if r)
    print(f"\n{ok}/{len(CARDS)} OG cards generated")
    return 0 if ok == len(CARDS) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
