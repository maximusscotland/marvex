# Mind-Mapper — Clip to Map (Chrome Extension)

A tiny Manifest V3 browser extension that lets users send any article, tweet, blog post, or text selection to [mind-mapper.com](https://mind-mapper.com) in one click.

## What it does

Two context-menu items appear on every web page:

- **Send this page to Mind-Mapper** — grabs the page `title` + `url` and opens `mind-mapper.com/intake?clip=…` in a new tab, pre-populated with a ready-to-edit outline.
- **Send selection to Mind-Mapper** — same, but includes the highlighted text (so you can clip just the quote you care about).

The extension icon (`Alt+Shift+M` once installed) also gives you a mini popup preview with both buttons.

No data leaves your browser except the title/URL/selection you explicitly send, and only to the Mind-Mapper host configured in **Options** (default `https://mind-mapper.com`).

## Installing for local development

1. Clone the repo and open `chrome://extensions` in Chrome / Edge / Brave / Arc (any Chromium browser).
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** → pick `/app/extension/`.
4. The Mind-Mapper brand-M icon appears in your toolbar. Pin it for easy access.

## Configuring a custom host (staging / self-hosted)

Right-click the extension icon → **Options** → paste your host (e.g. `https://mindmap-studio-5.preview.emergentagent.com`). Leave blank for the default.

## Publishing to the Chrome Web Store

1. Bump `"version"` in `manifest.json`.
2. Create real 16 / 48 / 128 px PNG icons at `icons/icon-{16,48,128}.png` (drop placeholder files in for now).
3. Zip the contents of `/app/extension/`:
   ```bash
   cd /app/extension && zip -r ../mind-mapper-clip-v0.1.0.zip .
   ```
4. Go to the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole), pay the one-time $5 registration fee, upload the zip, fill in the listing (short description copied from `manifest.json`, 5 screenshots, 1 small + 1 large promo tile), and submit.
5. Review is usually 2–5 business days.

## How the payload is shaped

When a user clicks a clip button, the background service worker assembles a JSON blob. The shape depends on whether Readability extraction succeeded.

**v:2 — rich article (page clips where Readability found a real article):**

```jsonc
{
  "url":     "https://example.com/article",
  "title":   "The Quiet Collapse of Expert Consensus",
  "article": {
    "title":    "The Quiet Collapse of Expert Consensus",
    "byline":   "Jane Smith",
    "excerpt":  "A short summary pulled by Readability…",
    "siteName": "Example Magazine",
    "length":   4312,
    "sections": [
      {"heading": "The hollowing-out",      "level": 2, "paragraphs": ["…", "…"]},
      {"heading": "What replaces the old?", "level": 2, "paragraphs": ["…"]}
    ]
  },
  "clippedAt": "2026-04-24T10:00:00Z",
  "source":    "chrome-extension",
  "v": 2
}
```

**v:1 — legacy / fallback (pages without an extractable article, or selection clips):**

```jsonc
{
  "url":       "https://example.com/article",
  "title":     "The Quiet Collapse of Expert Consensus",
  "selection": "…",
  "clippedAt": "2026-04-24T10:00:00Z",
  "source":    "chrome-extension",
  "v": 1
}
```

Both shapes are base64url-encoded and opened as `https://<MM_HOST>/intake?clip=<encoded>`. The `/intake` page reads the `clip=` query param, decodes it, and pre-seeds a Fixer card:

- **v:2** → structured heading tree (root title → About / byline / excerpt → per-section branches with paragraph leaves → Source URL)
- **v:1** + selection → root title → Source → "Clipped passage" with sentence-split leaves
- **v:1** bare → root title → Source → 3 placeholder branches ("Key ideas / Open questions / Next steps")

## Architecture

```
/app/extension/
├── manifest.json          # MV3 manifest — permissions, service worker, action
├── background.js          # Service worker — context menus + message bridge + Readability injection
├── content/
│   └── extract.js         # Content script — runs in page world, uses Readability to extract article
├── vendor/
│   └── Readability.js     # Mozilla's Readability library (vendored)
├── popup.html             # Toolbar popup — 340×auto
├── popup.css              # Cosmic dark theme
├── popup.js               # Reads active tab + selection, dispatches clip
├── options.html           # Options page — host override
├── options.js
├── icons/                 # 16 / 48 / 128 px PNGs
└── README.md              # you are here
```

## Next steps (backlog)

- **Firefox port** — MV3 support in Firefox is still evolving; bundle a MV2 fallback manifest when we target AMO.
- **Safari port** — ship a Safari Web Extension via Xcode's "Convert an Extension" helper.
- **Auth token handoff** — when the user is signed into mind-mapper.com in the browser, the clip flow works out-of-the-box; for signed-out users, `/intake` should surface a "Sign in to enrich / auto-deepen" CTA.
