"""
Fill-missing — copies English values from en.json into every other locale
for any keys that don't yet exist in that locale file.

Use this when:
  - The Emergent LLM key budget is exhausted and you can't re-run the full
    translator right now.
  - You added new keys to en.json and want to ship the feature in English
    across all locales until a proper translation pass lands later.

Usage (from /app):
    python scripts/fill_missing_locales.py

Idempotent. Does NOT overwrite existing translations — only fills gaps.
"""

import json
from pathlib import Path

ROOT = Path("/app/frontend/src/i18n/locales")
EN = json.loads((ROOT / "en.json").read_text())


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


en_flat = flatten(EN)

for path in sorted(ROOT.glob("*.json")):
    if path.name == "en.json":
        continue
    data = json.loads(path.read_text())
    flat = flatten(data)
    filled = 0
    for k, v in en_flat.items():
        if k not in flat:
            flat[k] = v  # English fallback
            filled += 1
    if filled == 0:
        print(f"✓ {path.name} already complete")
        continue
    # Re-persist, preserving key ordering of English source
    merged = {k: flat[k] for k in en_flat.keys()}
    path.write_text(json.dumps(unflatten(merged), ensure_ascii=False, indent=2) + "\n")
    print(f"+ {path.name}: filled {filled} missing keys with English fallback")

print("\nDone. Re-run scripts/translate_locales.py once the LLM budget is replenished.")
