"""
One-off image generator for the cinematic teaser opening frame.
Generates a single 16:9 hero image showing a complex academic book on the
left disintegrating across the centre of the frame into a futuristic
cosmic mind-map on the right. Saved straight to
/app/frontend/public/teaser/book-to-map.png so the landing teaser can
reference it as src="/teaser/book-to-map.png".

Run once:
    python /app/scripts/gen_book_to_map.py
"""
import asyncio
import base64
import os
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")

PROMPT = (
    "Cinematic 16:9 wide hero image. LEFT third of the frame: a heavy old-"
    "fashioned academic hardcover book lying open at an angle, leather-bound "
    "with gilded edges, dense classical typography on aged ivory pages, "
    "warm candle-lit highlights. CENTRE third: pages of the book actively "
    "tearing free and dissolving into glowing particles, golden sparks and "
    "neon-cyan shards mid-flight, motion blur arcing left-to-right, hint of "
    "physical text fragments transforming into geometric line-work. RIGHT "
    "third: a futuristic mind-map taking shape from the dissolving particles "
    "— neon cyan and electric purple nodes (rounded rectangles + ovals) "
    "connected by glowing wireframe lines, depicting concepts extracted from "
    "the book. Dark cosmic background with subtle starfield. Cohesive "
    "left-to-right transformation reading: book → particle storm → mind-map. "
    "Highly detailed, photo-real on the book side, holographic neon on the "
    "mind-map side, no text labels in the mind-map nodes (just glowing "
    "shapes), no watermarks, no UI chrome. 16:9 aspect ratio."
)


async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    chat = LlmChat(
        api_key=api_key,
        session_id="teaser-book-to-map",
        system_message="You are a meticulous concept-art director.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )
    msg = UserMessage(text=PROMPT)
    text, images = await chat.send_message_multimodal_response(msg)
    print(f"Text response: {text[:200] if text else '(none)'}")
    if not images:
        raise SystemExit("Nano Banana returned no images")
    out_dir = "/app/frontend/public/teaser"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "book-to-map.png")
    image_bytes = base64.b64decode(images[0]["data"])
    with open(out_path, "wb") as f:
        f.write(image_bytes)
    print(f"Saved {len(image_bytes):,} bytes → {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
