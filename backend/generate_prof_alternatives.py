"""
Regen v2 — "Ask the Prof" mature-professor character alternatives.

v1 read as "kindly grandads", not "PROFESSORS". v2 dials up explicit
academic context: chalkboards, gowns, lecterns, books, pointers,
mortarboards, lecture-hall lighting. Same painterly Pixar/Ghibli
warmth but with unmistakable professor signifiers.

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
    " Painterly storybook character illustration in the warm style of "
    "Pixar / Studio Ghibli concept art. Soft brushwork, warm rim-lighting, "
    "kind expressive eyes, slight smile, friendly approachable atmosphere. "
    "Portrait-orientation headshot composition — head, shoulders, and "
    "upper chest fill the frame, centered, character facing camera. "
    "Painterly background of soft cosmic blues and violets with a subtle "
    "bokeh of golden chalk-dust starlight (NOT photorealistic, NOT 3D, "
    "NOT line-art, NOT flat vector). Square 1024×1024 canvas designed "
    "to be cropped into a circular app avatar. No legible text or "
    "letters anywhere (any chalkboard markings are abstract painterly "
    "scribbles, not real words). No logos, no watermark, no signature, "
    "single character only."
)

PROFS = {
    # Classic stereotype: tweed + chalkboard + pointer
    "classic": (
        "An unmistakable classic university professor, a kindly mature "
        "man in his early 60s with neatly combed grey hair greying at "
        "the temples, a tidy short grey beard, warm intelligent brown "
        "eyes behind round wire-rim spectacles, gentle scholarly smile. "
        "Wearing a classic dark-brown TWEED JACKET with prominent LEATHER "
        "ELBOW PATCHES over a crisp white shirt and a maroon knit tie. "
        "Behind him a large dark-green CHALKBOARD covered in abstract "
        "painterly mathematical scribbles and diagrams (no real letters). "
        "Holding a piece of WHITE CHALK in his right hand, mid-gesture as "
        "if explaining a concept. Unmistakable professor."
    ),
    # Robed academic — gown + mortarboard
    "robed": (
        "A distinguished mature university professor in his mid-60s with "
        "swept-back silver hair, a neatly trimmed silver moustache and "
        "short beard, twinkling kind hazel eyes, a gentle dignified "
        "smile. Wearing full black ACADEMIC REGALIA — flowing black "
        "graduation GOWN with red and gold hood trim, a black square "
        "MORTARBOARD CAP with a gold tassel, over a crisp white shirt "
        "and dark tie. Background suggests an ornate old university hall "
        "with warm wood panelling and softly painted bookshelves."
    ),
    # Librarian-professor surrounded by towering books
    "librarian": (
        "A warm scholarly male professor in his late 60s with soft fluffy "
        "white hair, a full but neatly groomed white beard, warm twinkling "
        "blue eyes behind half-moon spectacles balanced on the tip of his "
        "nose, the kindest reassuring smile. Wearing a charcoal-grey "
        "tweed three-piece suit with a forest-green knit waistcoat and a "
        "burgundy bowtie. Tall painterly bookshelves crammed with leather-"
        "bound books loom warmly behind him, with a single brass desk-"
        "lamp throwing golden light across his shoulder. Holding an open "
        "leather-bound tome in his hands at the lower edge of frame."
    ),
    # Lecture-hall professor at the lectern, mid-talk
    "lecturer": (
        "A charismatic mature male professor in his late 50s mid-lecture, "
        "neatly trimmed salt-and-pepper hair, short groomed dark-grey "
        "beard, sharp intelligent green eyes behind dark-rimmed "
        "rectangular spectacles, a warm engaged smile as if speaking to "
        "students. Wearing a navy-blue blazer over a soft cream "
        "rollneck sweater, with a small academic LAPEL PIN on the "
        "blazer. Standing at a dark-wood LECTERN, one hand resting on "
        "an open notebook, the other raised in a teaching gesture. "
        "Behind him, soft golden lecture-hall light and the silhouette "
        "of a curved auditorium with warm bokeh."
    ),
    # Whimsical-but-clearly-academic with chalk dust + diagrams
    "chalk-dust": (
        "A delightfully whimsical mature male professor in his mid-60s "
        "with cheerfully messy grey hair flecked with WHITE CHALK DUST, "
        "expressive bushy white eyebrows, mischievous twinkling brown "
        "eyes behind round tortoiseshell spectacles pushed up his "
        "forehead, an enormous delighted smile mid-discovery. Wearing a "
        "rumpled mustard-yellow CARDIGAN with leather elbow patches "
        "over a soft sky-blue shirt with a slightly askew burgundy tie. "
        "A small SMUDGE OF CHALK on one cheek. Behind him a chalkboard "
        "covered in abstract painterly orbital diagrams, swirls and "
        "constellations. Holding a stick of chalk between his fingers. "
        "Professor who genuinely loves teaching."
    ),
    # Field-research professor — botanist / naturalist explorer vibe
    "field": (
        "A weathered but warm mature male professor-naturalist in his "
        "early 60s with neatly tied-back grey-and-silver hair, a "
        "well-groomed short greying beard, kind crinkle-eyed smile, "
        "intelligent warm hazel eyes behind small round brass-framed "
        "spectacles. Wearing a classic explorer's outfit — a worn olive-"
        "green tweed FIELD JACKET with brown leather trim and many "
        "pockets, over a soft khaki shirt with a small dark green "
        "neckerchief. A pair of vintage brass binoculars hung around "
        "his neck. Background suggests a sun-dappled painterly herbarium "
        "with hanging botanical sketches and dried specimens, warm "
        "afternoon light. Unmistakably a learned professor of natural "
        "history."
    ),
}


async def generate_one(name: str, prompt: str) -> bool:
    full_prompt = f"{prompt}{STYLE}"
    chat = (
        LlmChat(
            api_key=API_KEY,
            session_id=f"prof2-{name}-{uuid.uuid4().hex[:6]}",
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
