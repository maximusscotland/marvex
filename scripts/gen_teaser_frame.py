"""
Quick parameterised image generator for the cinematic teaser.

Usage:
    python /app/scripts/gen_teaser_frame.py <slug> "<prompt>"

Saves PNG to /app/frontend/public/teaser/<slug>.png
"""
import asyncio
import base64
import os
import sys
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")


async def main(slug, prompt):
    api_key = os.getenv("EMERGENT_LLM_KEY")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"teaser-{slug}",
        system_message="You are a meticulous concept-art director.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )
    msg = UserMessage(text=prompt)
    text, images = await chat.send_message_multimodal_response(msg)
    if not images:
        raise SystemExit(f"No images returned for {slug}: {text[:120] if text else ''}")
    out_dir = "/app/frontend/public/teaser"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{slug}.png")
    image_bytes = base64.b64decode(images[0]["data"])
    with open(out_path, "wb") as f:
        f.write(image_bytes)
    print(f"[{slug}] saved {len(image_bytes):,} bytes → {out_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python gen_teaser_frame.py <slug> '<prompt>'")
        sys.exit(2)
    asyncio.run(main(sys.argv[1], sys.argv[2]))
