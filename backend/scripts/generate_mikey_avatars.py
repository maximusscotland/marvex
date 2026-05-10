"""
Generate 4 Cosmic Owl-Professor avatars for Mikey, Marvex Studio's research
assistant. Run once; outputs land in /app/frontend/public/mikey/.
"""
import asyncio
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")

OUT_DIR = Path("/app/frontend/public/mikey")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Shared style direction so all 4 variants stay coherent.
STYLE = (
    "A friendly, slightly geeky cartoon owl character — Mikey, the research "
    "assistant for Marvex Studio. Warm gradient feathers in deep cosmic navy, "
    "violet and magenta. Round wire-frame spectacles glowing with subtle cyan "
    "neon. Big intelligent amber eyes that look kind, focused, never creepy. "
    "Soft cosmic-dark background with a faint nebula and tiny constellation "
    "stars (#00f0ff and #ff6ad5 specks). Modern flat illustration with "
    "cel-shading + soft inner glow — NOT photorealistic, NOT 3D-rendered. "
    "Style: Pixar storyboard meets Studio Ghibli space scene. The owl looks "
    "wise but approachable, like a patient university tutor. Avoid uncanny "
    "human features, avoid headsets, avoid generic AI-robot tropes."
)

VARIANTS = [
    (
        "headshot",
        "Tight headshot framing — head and upper chest only, centred, looking "
        "directly at the camera with a small warm smile. Suitable as a chat-"
        "bubble avatar / profile picture. 1:1 square crop. The owl wears a "
        "small graduation-style scholar's cap in violet velvet with a glowing "
        "cyan tassel. Subtle constellation pattern on the cap. " + STYLE,
    ),
    (
        "scholar-pose",
        "Three-quarter view, waist-up — Mikey sits at a glowing holographic "
        "desk holding an open glowing constellation map / mind-map made of "
        "neon nodes and lines. One wing-finger pointing thoughtfully at a node "
        "as if explaining something. Wears a scholar's cap and a wireframe "
        "scarf. Cosmic study background with floating mind-map nodes. " + STYLE,
    ),
    (
        "drift-fullbody",
        "Full-body, drifting weightlessly through cosmic space, scarf trailing "
        "behind like a nebula. Holding a small glowing book of constellations "
        "in one wing. Body angled slightly downward like a benevolent guide. "
        "More cinematic, less centred — Mikey takes the lower-left third of "
        "the frame, the rest is deep cosmic vista with a Marvex-style "
        "constellation forming the shape of a mind-map in the distance. " + STYLE,
    ),
    (
        "thinking-bubble",
        "Cute side-view headshot — Mikey looking up at a glowing thought "
        "bubble made of neon mind-map nodes (cyan + magenta) connected by "
        "soft beams. One wing tip resting under his chin in a classic "
        "'thinking' pose. Subtle smile. Small graduation cap tilted at a "
        "playful angle. Used as the loading / 'Mikey is thinking…' indicator. " + STYLE,
    ),
]


async def gen_one(name: str, prompt: str) -> bool:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print(f"[{name}] ERROR: EMERGENT_LLM_KEY missing")
        return False
    chat = (
        LlmChat(api_key=api_key, session_id=f"mikey-{name}", system_message="You are an art-direction assistant.")
        .with_model("gemini", "gemini-3.1-flash-image-preview")
        .with_params(modalities=["image", "text"])
    )
    msg = UserMessage(text=prompt)
    text, images = await chat.send_message_multimodal_response(msg)
    print(f"[{name}] text response: {(text or '')[:80]}…")
    if not images:
        print(f"[{name}] FAIL — no images returned")
        return False
    img_bytes = base64.b64decode(images[0]["data"])
    out = OUT_DIR / f"mikey-{name}.png"
    out.write_bytes(img_bytes)
    print(f"[{name}] saved → {out} ({len(img_bytes)} bytes)")
    return True


async def main():
    results = []
    for name, prompt in VARIANTS:
        try:
            ok = await gen_one(name, prompt)
        except Exception as exc:
            print(f"[{name}] EXCEPTION: {exc}")
            ok = False
        results.append((name, ok))
    print("\n=== SUMMARY ===")
    for name, ok in results:
        print(f"  {name}: {'OK' if ok else 'FAIL'}")
    failed = [n for n, ok in results if not ok]
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
