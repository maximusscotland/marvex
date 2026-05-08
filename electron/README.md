# Mind-Mapper — Desktop build

Electron wrapper around the live [mind-mapper.com](https://mind-mapper.com) app. Produces native installers for Windows, macOS, and Linux — with GitHub Releases as the auto-update channel.

## Prerequisites

- Node.js 20+
- Yarn or npm
- (macOS signed builds only) Apple Developer account + certificate in Keychain
- (Publishing only) a `GH_TOKEN` env var with `repo` scope

## Quick start — run locally

```bash
cd /app/electron
yarn install

# Option A: live mode only — loads https://mind-mapper.com
yarn start

# Option B: build + embed the offline bundle first, then start
yarn bundle          # builds frontend/build/ and copies it into assets/web/
yarn start
```

When the offline bundle is embedded, the wrapper will:
1. Probe `WEB_URL` for 6s at launch
2. On success → load the live site (full feature set)
3. On failure → load `file://…/assets/web/index.html` and show an amber "You're offline" banner
4. Re-probe every 30s and silently swap back to live mode when the network returns

Want to point at your own staging / preview URL?

```bash
MM_WEB_URL=https://your-preview.example.com yarn start
```

## Offline fallback — what works, what doesn't

When users lose connectivity, the bundled build keeps running. These features degrade:

| Feature                | Online | Offline |
|------------------------|--------|---------|
| Create / edit maps     | ✅     | ✅      |
| PDF reader (local file)| ✅     | ✅      |
| Ink annotations        | ✅     | ✅      |
| Highlights ledger      | ✅     | ✅      |
| Export PNG/SVG/MD/PDF  | ✅     | ✅      |
| AI Research / Deepen   | ✅     | ❌ (backend unreachable) |
| Cloud sync             | ✅     | ❌ (queues locally)      |
| Shareable links        | ✅     | ❌                       |
| Stripe upgrade flow    | ✅     | ❌                       |

The "You're offline" banner surfaces this with a 1-click **Reconnect** probe.

## Build installers

```bash
yarn dist:win     # .exe installer + portable — Windows x64 + ARM64
yarn dist:mac     # .dmg + .zip — Apple Silicon + Intel
yarn dist:linux   # .AppImage + .deb + .rpm
yarn dist:all     # everything, everywhere, all at once
```

Outputs land in `/app/electron/dist/`.

## Publish a release (auto-updates users)

1. Bump `version` in `package.json`.
2. Replace `YOUR_GITHUB_USERNAME` in `package.json` → `build.publish.owner` with your actual GitHub org/username.
3. Export a GitHub token with `repo` scope:
   ```bash
   export GH_TOKEN=ghp_xxx
   ```
4. Publish:
   ```bash
   yarn publish
   ```

Installed desktop apps will see the update within 24 hours and prompt the user (see `main.js` `autoUpdater` handlers).

## macOS signing & notarisation

Unsigned builds run, but macOS will show a "Cannot verify developer" warning. To enable proper signing:

1. Join [Apple Developer Program](https://developer.apple.com/programs/) ($99/yr).
2. Get a **Developer ID Application** certificate in Keychain.
3. Set these env vars before building:
   ```bash
   export APPLE_ID=you@example.com
   export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
   export APPLE_TEAM_ID=ABCDE12345
   export CSC_LINK=/path/to/cert.p12
   export CSC_KEY_PASSWORD=yourpassword
   ```
4. `yarn dist:mac` — electron-builder signs + notarises automatically.

## CI — GitHub Actions

See `.github/workflows/electron-build.yml` (three matrix jobs: ubuntu-latest, windows-latest, macos-14). Triggers on any `v*.*.*` tag push and uploads artifacts to the corresponding GitHub Release.

## Next steps (backlog)

- **App icon** — replace the default Electron icon. Drop a 1024×1024 `icon.png` into `assets/` (electron-builder will generate all platform sizes) — OR run Gemini Nano Banana to produce one:
  ```bash
  python /app/backend/generate_icons.py --target desktop-icon
  ```
- **Native menu bindings** — extend `main.js` `buildAppMenu()` to call React via IPC instead of loading URLs.
