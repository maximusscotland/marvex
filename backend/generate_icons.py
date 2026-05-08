"""
One-shot icon generator for Mind-Mapper Studio. Generates 4 cosmic-themed feature
icons via Gemini Nano Banana (gemini-3.1-flash-image-preview) and saves to
/app/frontend/public/icons/. Run once from the backend venv:

    cd /app/backend && python generate_icons.py
"""
import asyncio
import base64
import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv(Path(__file__).parent / ".env")
API_KEY = os.environ["EMERGENT_LLM_KEY"]
OUT_DIR = Path("/app/frontend/public/icons")
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "gemini-3.1-flash-image-preview"

# Shared style suffix — keeps all icons visually coherent with the app
STYLE = (
    " Flat minimalist single-centered iconography, no text, no letters, "
    "no words, no typography. Neon cyan (#00F0FF) and electric violet (#7A3BFF) "
    "accents on a deep navy cosmic background (#030714). Soft volumetric glow, "
    "clean vector-feel silhouette, symmetrical composition, 1024x1024, "
    "circular icon badge with subtle inner glow ring."
)

ICONS = {
    "pdf-studio": (
        "A glowing cosmic filter funnel: a stack of three holographic document "
        "sheets being refracted through a neon ring, representing the intake "
        "and filtering of PDFs into a clean mind-map."
    ),
    "research-assistant": (
        "A neural-network constellation shaped like a glowing synaptic brain-node, "
        "with five delicate light trails branching out and tiny sparkling star "
        "tips at the ends. Represents an AI research assistant expanding ideas."
    ),
    "library": (
        "A cosmic bookshelf reimagined as a constellation: three upright book "
        "spines made of connected star dots with subtle gold highlights, "
        "representing a digital research library."
    ),
    "enrich": (
        "A triangular prism of light in the center refracting one beam into three "
        "radiant sub-branches with small sparkle tips, representing AI enrichment "
        "of a heading into sub-concepts. Violet-to-cyan gradient."
    ),
}


async def generate_one(name: str, prompt: str) -> bool:
    full_prompt = f"{prompt}{STYLE}"
    chat = LlmChat(
        api_key=API_KEY,
        session_id=f"iconify-{uuid.uuid4().hex[:8]}",
        system_message="You are a world-class icon designer. Output images only.",
    ).with_model("gemini", MODEL).with_params(modalities=["image", "text"])

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
    path = OUT_DIR / f"{name}.png"
    path.write_bytes(raw)
    print(f"[{name}] saved {path} ({len(raw) // 1024} KB)")
    return True


async def main() -> int:
    results = await asyncio.gather(
        *[generate_one(n, p) for n, p in ICONS.items()]
    )
    ok = sum(1 for r in results if r)
    print(f"\n{ok}/{len(ICONS)} icons generated")
    return 0 if ok == len(ICONS) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
