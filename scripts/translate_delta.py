"""
Delta translator — translates ONLY the keys passed on the command line into
every locale, then merges the result into each locale file.

Why a separate script? The full `translate_locales.py` re-translates ~230
strings per locale, which is fragile when the Emergent LLM gateway is
flaky. This delta variant ships ~4 keys per call so a single 502 doesn't
nuke the whole run.

Usage (from anywhere):
    python /app/scripts/translate_delta.py landing.feature.smartReader \\
                                           landing.feature.openAnything \\
                                           landing.feature.calendar    \\
                                           landing.feature.bookmarks

Honours the same MODEL env var as the parent script.
"""

import asyncio
import json
import os
import sys
import time
from pathlib import Path

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
except ImportError:
    print("Install: pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/")
    sys.exit(1)


ROOT = Path("/app/frontend/src/i18n/locales")
SOURCE = ROOT / "en.json"
TARGETS = [
    ("es", "Spanish (Latin American + European, neutral)"),
    ("fr", "French (Metropolitan France)"),
    ("de", "German (standard Hochdeutsch)"),
    ("pt", "Portuguese (Brazilian)"),
    ("it", "Italian"),
    ("nl", "Dutch (Netherlands)"),
    ("pl", "Polish"),
    ("ja", "Japanese (standard)"),
    ("zh-Hans", "Simplified Chinese (Mainland China)"),
]


def get_path(obj, dotted):
    cur = obj
    for p in dotted.split("."):
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


def set_path(obj, dotted, value):
    parts = dotted.split(".")
    cur = obj
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


def collect_subtree_strings(node, prefix=""):
    """Flatten a sub-tree of {key: str | nested-dict} into {dotted_key: str}."""
    out = {}
    if isinstance(node, dict):
        for k, v in node.items():
            out.update(collect_subtree_strings(v, f"{prefix}.{k}" if prefix else k))
    elif isinstance(node, str):
        out[prefix] = node
    return out


def clean_json_response(text):
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1]
        if t.lower().startswith("json"):
            t = t[4:].lstrip()
        if t.rstrip().endswith("```"):
            t = t.rstrip().rstrip("`").rstrip()
    return t


async def translate(chat, target_label, strings, retries=3):
    bundle = json.dumps(strings, ensure_ascii=False, indent=2)
    prompt = (
        f"Translate the English values in this JSON object into {target_label}. "
        f"Return ONLY valid JSON with the exact same keys and translated values "
        f"(no code fences, no commentary). Preserve placeholders, the dot `·`, "
        f"em-dashes, ellipses, and the word 'mind-mapper' exactly. Keep "
        f"marketing tone: confident, concise, welcoming.\n\nInput:\n{bundle}"
    )
    last_err = None
    for attempt in range(retries):
        try:
            resp = await chat.send_message(UserMessage(text=prompt))
            data = json.loads(clean_json_response(resp))
            if not isinstance(data, dict):
                raise RuntimeError(f"Expected dict, got {type(data).__name__}")
            return data
        except Exception as e:
            last_err = e
            await asyncio.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Failed after {retries}: {last_err}")


async def main():
    if len(sys.argv) < 2:
        print("Usage: translate_delta.py <dotted.key> [<dotted.key> ...]")
        sys.exit(2)
    keys = sys.argv[1:]

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        for line in Path("/app/backend/.env").read_text().splitlines():
            if line.startswith("EMERGENT_LLM_KEY"):
                api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
    if not api_key:
        print("ERROR: EMERGENT_LLM_KEY not set")
        sys.exit(1)

    en = json.loads(SOURCE.read_text())
    # Collect every leaf string under the requested keys.
    payload = {}
    for k in keys:
        sub = get_path(en, k)
        if sub is None:
            print(f"  ⚠ key missing in en.json: {k}")
            continue
        payload.update(collect_subtree_strings(sub, prefix=k))
    print(f"Source: {len(payload)} strings under {keys}")
    if not payload:
        return

    model_choice = os.environ.get("MODEL", "premium").lower()
    PROVIDER_MODEL = {
        "cheap":    ("openai", "gpt-4o-mini"),
        "balanced": ("openai", "gpt-4o"),
        "premium":  ("anthropic", "claude-sonnet-4-5-20250929"),
        "gemini":   ("gemini", "gemini-2.5-flash"),
    }.get(model_choice, ("anthropic", "claude-sonnet-4-5-20250929"))
    print(f"Model: {PROVIDER_MODEL[0]} / {PROVIDER_MODEL[1]}")

    for code, label in TARGETS:
        out_path = ROOT / f"{code}.json"
        existing = json.loads(out_path.read_text()) if out_path.exists() else {}
        print(f"\n→ {code} ({label})")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"delta-{code}-{int(time.time())}",
            system_message=(
                "You are a professional localisation specialist. You translate "
                "JSON bundles of UI copy from English to the target language, "
                "preserving keys and placeholders exactly."
            ),
        ).with_model(PROVIDER_MODEL[0], PROVIDER_MODEL[1])
        try:
            translated = await translate(chat, label, payload)
        except Exception as e:
            print(f"  ✗ {code} failed: {e}. Falling back to English for missing keys.")
            translated = {k: v for k, v in payload.items()}
        # Merge into existing locale file.
        for dotted, val in translated.items():
            set_path(existing, dotted, val)
        out_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n")
        print(f"  ✓ wrote {out_path.relative_to(Path('/app'))}")

    print("\nDelta translation complete.")


if __name__ == "__main__":
    asyncio.run(main())
