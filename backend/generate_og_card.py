"""
One-shot social-share Open Graph card generator for Marvex Studio.

Generates a single branded 1200×630 OG card (the spec used by Twitter,
LinkedIn, Facebook, Reddit, Discord, Slack, iMessage previews — every
modern social platform standardises on 1.91:1).

Why one card instead of per-page:
  • The visual is intentionally non-textual — cosmic mind-map silhouette
    on a deep navy/violet gradient. Per-page text variants would require
    pixel-perfect typography, which is hard to get right via image
    generation. Twitter's card uses the og:title meta tag for headline,
    so the image just needs to be brand-recognisable.
  • Reusing one OG card cuts hosting cost, simplifies the markup, and
    means adding new pages "just works".
  • Per-page cards CAN be added later (see /press, /pricing) by passing
    `image: "/og/<custom>.png"` to `usePageMeta({})`.

Output: /app/frontend/public/og/marvex-default.png  (1200×630)

Usage:  cd /app/backend && python generate_og_card.py
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

PROMPT = (
    "A cinematic Open Graph social share card, exact 16:9 wide aspect "
    "(1200×630). Deep navy void background (#030714) with subtle "
    "violet→cyan gradient depth, soft particle/star field. "
    "LEFT HALF: a glowing radial mind-map silhouette — one large central "
    "neon-cyan node connected to 6 smaller violet satellite nodes by "
    "thin glowing connector lines, all rendered in clean vector style "
    "with soft outer glow. "
    "RIGHT HALF: a stylised PDF document silhouette with cyan stroke, "
    "tilted slightly, with a glowing arrow flowing from it into the "
    "mind-map on the left — visually conveying 'PDF transforms into "
    "mind map'. "
    "Tasteful film-grain noise overlay for premium feel. "
    "NO TEXT, NO LETTERS, NO WORDS, NO LOGOS — text will be overlaid "
    "later via meta tags. "
    "Composition leaves balanced negative space top and bottom for "
    "platform UI chrome. Centred, balanced, premium SaaS aesthetic, "
    "highly legible at thumbnail size."
)

TARGET_W, TARGET_H = 1200, 630


async def main() -> int:
    chat = (
        LlmChat(
            api_key=API_KEY,
            session_id=f"og-card-{uuid.uuid4().hex[:8]}",
            system_message="You are a world-class brand designer. Output images only.",
        )
        .with_model("gemini", MODEL)
        .with_params(modalities=["image", "text"])
    )

    try:
        _, images = await chat.send_message_multimodal_response(
            UserMessage(text=PROMPT)
        )
    except Exception as exc:  # noqa: BLE001
        print(f"generation error: {exc}")
        return 1

    if not images:
        print("no image returned")
        return 1

    raw = base64.b64decode(images[0]["data"])
    master_path = OUT_DIR / "marvex-default-master.png"
    master_path.write_bytes(raw)
    print(f"saved master {master_path} ({len(raw) // 1024} KB)")

    # Resize to exact OG spec (1200×630). Nano Banana sometimes returns
    # 1024×1024 or 16:9 but at off-spec resolution; we always normalise.
    img = Image.open(master_path).convert("RGB")
    target_aspect = TARGET_W / TARGET_H
    img_aspect = img.width / img.height

    if abs(img_aspect - target_aspect) < 0.02:
        # Aspect already matches — straight resize
        img = img.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    elif img_aspect > target_aspect:
        # Too wide — crop sides
        new_w = int(img.height * target_aspect)
        left = (img.width - new_w) // 2
        img = img.crop((left, 0, left + new_w, img.height)).resize((TARGET_W, TARGET_H), Image.LANCZOS)
    else:
        # Too tall — crop top/bottom
        new_h = int(img.width / target_aspect)
        top = (img.height - new_h) // 2
        img = img.crop((0, top, img.width, top + new_h)).resize((TARGET_W, TARGET_H), Image.LANCZOS)

    out_png = OUT_DIR / "marvex-default.png"
    img.save(out_png, format="PNG", optimize=True)
    print(f"wrote {out_png} ({TARGET_W}×{TARGET_H}, {os.path.getsize(out_png) // 1024} KB)")

    # Also write WebP for next/og/picture support down the line
    out_webp = OUT_DIR / "marvex-default.webp"
    img.save(out_webp, format="WEBP", quality=88, method=6)
    print(f"wrote {out_webp} ({os.path.getsize(out_webp) // 1024} KB)")

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
