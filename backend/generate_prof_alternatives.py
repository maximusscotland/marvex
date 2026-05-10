"""
One-shot generator for "Ask the Prof" mature-professor character
alternatives. Painterly storybook (Pixar/Ghibli) style, headshot
composition, 6 distinct personas so the user can pick the favourite
before we wire it into the launcher.

Outputs to /app/frontend/public/prof-alternatives/prof-{slug}.png
(public/ so we can preview them via Pillow grid + browser).

Usage:
    cd /app/backend && python generate_prof_alternatives.py
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
OUT_DIR = Path("/app/frontend/public/prof-alternatives")
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "gemini-3.1-flash-image-preview"

STYLE = (
    " Painterly storybook illustration in the warm style of Pixar / Studio "
    "Ghibli character art. Soft brushwork, gentle directional lighting, "
    "warm rim-light, kind expressive eyes, slight smile, friendly inviting "
    "atmosphere. Circular headshot composition — face and shoulders fill "
    "the frame, centered. Painterly background of soft cosmic blues and "
    "violets with subtle bokeh / starlight (NOT photorealistic, NOT 3D, "
    "NOT line-art, NOT flat vector). Square 1024×1024 canvas designed to "
    "be cropped to a circle for an app avatar. No text, no letters, no "
    "logos, no watermark. Single character only, no other people."
)

PROFS = {
    "einstein": (
        "A kindly mature male professor in his late 60s with a great mane "
        "of wild fluffy white hair, soft bushy white moustache, warm "
        "twinkling brown eyes, gentle grandfather smile, wearing a rumpled "
        "tweed jacket with leather elbow patches over a soft beige knit "
        "sweater. Loose painterly brushstrokes, a hint of chalk dust on "
        "his collar."
    ),
    "bookish": (
        "A warm bookish male professor in his early 60s with neatly combed "
        "silver hair, well-groomed short silver beard, round wire-rim "
        "spectacles, soft blue eyes, a contented smile. Wearing a forest-"
        "green wool cardigan over a white shirt, with an open hardcover "
        "book held gently in one hand visible at the bottom of the frame. "
        "Cosy academic warmth."
    ),
    "bowtie": (
        "A distinguished mature male professor in his mid-60s with neatly "
        "trimmed swept-back grey hair, a small tidy grey moustache, sharp "
        "intelligent green eyes, a confident knowing smile. Wearing a deep "
        "burgundy bowtie, mustard-yellow waistcoat, and crisp white shirt. "
        "Dignified Oxford-don energy with a playful glint."
    ),
    "inventor": (
        "A whimsical mature male professor-inventor in his late 60s with "
        "delightfully messy grey hair sticking up in every direction, "
        "round brass goggles perched on his forehead, bushy expressive "
        "white eyebrows, mischievous warm brown eyes, a big delighted "
        "smile. Wearing a long mossy-green linen apron over a rumpled "
        "indigo shirt, with a small smudge of cosmic stardust on one "
        "cheek. Curious and inviting, like he just discovered something."
    ),
    "cosy": (
        "A warm cosy male professor in his mid-60s with soft silver hair "
        "tucked behind his ears, gentle laugh-lines around kind hazel "
        "eyes, a neat short white beard, the warmest grandfatherly smile. "
        "Wearing a thick chunky-knit charcoal-grey cardigan and a long "
        "wrapped mustard scarf, holding a steaming ceramic mug of tea "
        "visible at the lower edge. Quiet, reassuring, hot-cocoa-by-the-"
        "fireplace energy."
    ),
    "mentor": (
        "A dignified mature male mentor-professor in his late 50s with "
        "short neatly-trimmed salt-and-pepper hair, a tidy short greying "
        "beard, thoughtful warm grey-blue eyes behind slim dark-rimmed "
        "rectangular glasses, a gentle reassuring smile. Wearing a navy "
        "blazer over a soft cream rollneck. Approachable mentor energy, "
        "the favourite teacher who actually believed in you."
    ),
}


async def generate_one(name: str, prompt: str) -> bool:
    full_prompt = f"{prompt}{STYLE}"
    chat = (
        LlmChat(
            api_key=API_KEY,
            session_id=f"prof-{name}-{uuid.uuid4().hex[:6]}",
            system_message="You are a world-class storybook character illustrator. Output images only.",
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
    path = OUT_DIR / f"prof-{name}.png"
    path.write_bytes(raw)
    print(f"[{name}] saved {path} ({len(raw) // 1024} KB)")
    return True


async def main() -> int:
    results = await asyncio.gather(*[generate_one(n, p) for n, p in PROFS.items()])
    ok = sum(1 for r in results if r)
    print(f"\n{ok}/{len(PROFS)} professor alternatives generated")
    return 0 if ok == len(PROFS) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
