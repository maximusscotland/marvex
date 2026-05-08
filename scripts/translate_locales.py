"""
Dev-time translator — reads /app/frontend/src/i18n/locales/en.json and
AI-translates every string to the other supported locales via Claude Sonnet
4.5 (Emergent LLM key). Output is written to <code>.json alongside en.json.

Design goals:
  - One shot. Never runs at app runtime.
  - Preserves JSON structure 1:1 (we prompt the LLM for a JSON-only reply).
  - Preserves interpolation placeholders like {{name}} verbatim.
  - Skips the brand string (`common.brand`) so "mind-mapper" stays everywhere.
  - Idempotent: running it again overwrites the target files.

Usage (from /app):
    cd /app/backend && python /app/scripts/translate_locales.py

Can be re-run any time en.json changes. Review the diff before committing.
"""

import asyncio
import json
import os
import sys
import time
from pathlib import Path

# Make sure we can import emergentintegrations if run standalone
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
except ImportError:
    print("emergentintegrations is not installed. Install:")
    print("  pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/")
    sys.exit(1)


ROOT = Path("/app/frontend/src/i18n/locales")
SOURCE = ROOT / "en.json"

# (code, human name) pairs — keep in sync with i18n/index.js
TARGETS = [
    ("es",      "Spanish (Latin American + European, neutral)"),
    ("fr",      "French (Metropolitan France)"),
    ("de",      "German (standard Hochdeutsch)"),
    ("pt",      "Portuguese (Brazilian)"),
    ("it",      "Italian"),
    ("nl",      "Dutch (Netherlands)"),
    ("pl",      "Polish"),
    ("ja",      "Japanese (standard)"),
    ("zh-Hans", "Simplified Chinese (Mainland China)"),
]

# Strings we deliberately keep in English across all locales
PRESERVE_KEYS = {"common.brand"}


def flatten(obj, prefix=""):
    out = {}
    for k, v in obj.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def unflatten(flat):
    root = {}
    for key, val in flat.items():
        parts = key.split(".")
        cur = root
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = val
    return root


def build_prompt(target_label, strings):
    # Strings is a dict of key -> english text. Ask for JSON back keyed the
    # same way. Keep the instruction short & concrete — Claude is great at
    # this format when you give it one.
    bundle = json.dumps(strings, ensure_ascii=False, indent=2)
    return (
        f"Translate the English values in this JSON object into {target_label}. "
        f"Return ONLY valid JSON with the exact same keys and the translated values "
        f"(no code fences, no commentary, no extra keys). "
        f"Preserve any {{{{placeholders}}}}, the dot `·`, em-dashes, ellipses, and "
        f"the word 'mind-mapper' exactly. Keep marketing tone: confident, concise, "
        f"welcoming. Short UI phrases should stay short in the target language.\n\n"
        f"Input:\n{bundle}"
    )


def clean_json_response(text):
    t = text.strip()
    # Strip code fences if the model returns them anyway
    if t.startswith("```"):
        t = t.split("```", 2)[1]
        if t.lower().startswith("json"):
            t = t[4:].lstrip()
        # drop trailing ``` if present
        if t.rstrip().endswith("```"):
            t = t.rstrip().rstrip("`").rstrip()
    return t


async def translate_bundle(chat, target_label, strings, retries=3):
    prompt = build_prompt(target_label, strings)
    last_err = None
    for attempt in range(retries):
        try:
            resp = await chat.send_message(UserMessage(text=prompt))
            cleaned = clean_json_response(resp)
            data = json.loads(cleaned)
            if not isinstance(data, dict):
                raise RuntimeError(f"Expected dict, got {type(data).__name__}")
            return data
        except Exception as e:
            last_err = e
            backoff = 4 * (attempt + 1)
            print(f"  ⚠ attempt {attempt + 1}/{retries} failed: {e}. Retrying in {backoff}s...")
            await asyncio.sleep(backoff)
    raise RuntimeError(f"Giving up after {retries} attempts: {last_err}")


async def main():
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        # Fallback: read from /app/backend/.env
        env_file = Path("/app/backend/.env")
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("EMERGENT_LLM_KEY"):
                    api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not api_key:
        print("ERROR: EMERGENT_LLM_KEY not set")
        sys.exit(1)

    source = json.loads(SOURCE.read_text())
    flat = flatten(source)

    # Remove preserved keys before translation
    preserved = {k: flat[k] for k in PRESERVE_KEYS if k in flat}
    translatable = {k: v for k, v in flat.items() if k not in PRESERVE_KEYS}

    print(f"Source: {len(flat)} strings  ·  translating {len(translatable)}  ·  preserving {len(preserved)}")

    # Allow choosing a cheaper model for budget-constrained runs.
    # MODEL=cheap → gpt-4o-mini (~50x cheaper than Claude Sonnet 4.5, still
    # excellent at JSON translation tasks)
    # MODEL=balanced → gpt-4o (default mid-tier)
    # MODEL=premium / unset → Claude Sonnet 4.5 (highest quality)
    # MODEL=gemini → gemini-2.5-flash (fallback when Anthropic gateway is
    #   degraded; very cheap, generous free tier, decent multilingual quality)
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
        # Skip if the user passed SKIP_DONE=1 — used to resume after a crash
        # by skipping locales that already have non-English content. We
        # heuristically check whether the file's first 50 translatable values
        # differ from the English source; if too many match, treat as
        # "still English fallback" and retranslate.
        if os.environ.get("SKIP_DONE") == "1" and out_path.exists():
            try:
                cur = json.loads(out_path.read_text())
                cur_flat = flatten(cur)
                same = sum(1 for k in translatable if k in cur_flat and cur_flat[k] == translatable[k])
                pct_same = same / max(1, len(translatable))
                if pct_same < 0.30:
                    print(f"\n→ {code} ({label}) — already translated (only {pct_same:.0%} same as EN). Skipping.")
                    continue
            except Exception:
                pass
        print(f"\n→ {code} ({label})")
        # Fresh chat per language so earlier translations don't leak between locales
        chat = LlmChat(
            api_key=api_key,
            session_id=f"translate-{code}-{int(time.time())}",
            system_message=(
                "You are a professional localisation specialist. You translate "
                "JSON bundles of UI copy from English to the target language, "
                "preserving keys and placeholders exactly."
            ),
        ).with_model(PROVIDER_MODEL[0], PROVIDER_MODEL[1])

        try:
            translated = await translate_bundle(chat, label, translatable)
        except Exception as e:
            # Do NOT abort the whole run on a single locale failure — log,
            # keep the existing file, and move on. The user can re-run later.
            print(f"  ✗ {code} translation failed: {e}. Skipping (existing file unchanged).")
            continue

        # Validate: every input key must be present in the output
        missing = [k for k in translatable if k not in translated]
        if missing:
            print(f"  ⚠ missing {len(missing)} keys, filling with English fallback: {missing[:3]}...")
            for k in missing:
                translated[k] = translatable[k]

        # Prune any extra keys the model may have hallucinated — only ship
        # keys that exist in the English source.
        extra = [k for k in translated if k not in translatable]
        for k in extra:
            del translated[k]
        if extra:
            print(f"  ⚠ pruned {len(extra)} extra keys the model invented: {extra[:3]}...")

        # Merge preserved keys back
        for k, v in preserved.items():
            translated[k] = v

        out = unflatten(translated)
        out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
        print(f"  ✓ wrote {out_path.relative_to(Path('/app'))}")

    print("\nDone. Review diffs, commit, and ship.")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
