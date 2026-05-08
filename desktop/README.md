# mind-mapper desktop wrapper

Electron + electron-builder + electron-updater. Hybrid build:

- Renderer: a static copy of the React UI baked into the installer (built
  from `/app/frontend/`).
- Backend: every AI / cloud-sync / billing call still goes to
  `REACT_APP_BACKEND_URL` (default `https://mind-mapper.com`).
- Updates: 100% user-initiated. The user clicks **Check for updates…**
  in the native menu (or via an in-app link surfaced when running in
  Electron). Nothing installs in the background without confirmation.

## Local development

```bash
cd /app/desktop
yarn install
REACT_APP_BACKEND_URL=https://mind-mapper.com yarn build:renderer
yarn start
```

## Producing installers

Cross-compile is done in **GitHub Actions** — see
`/app/.github/workflows/desktop-release.yml`. To build locally for the
host platform only:

```bash
# Mac (requires APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID
# env vars to notarize)
REACT_APP_BACKEND_URL=https://mind-mapper.com yarn dist:mac

# Windows (unsigned for v1)
REACT_APP_BACKEND_URL=https://mind-mapper.com yarn dist:win

# Linux
REACT_APP_BACKEND_URL=https://mind-mapper.com yarn dist:linux
```

## Releasing

Tag a release on GitHub:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The Actions workflow runs on every `v*` tag, builds for all three
platforms, and uploads the artifacts to a GitHub Release. `electron-updater`
on installed clients pulls from the latest GitHub Release feed.

## Code signing

- **macOS**: required for silent first-launch and for `electron-updater`
  to verify update authenticity. Provide `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` as repo secrets.
- **Windows**: shipped unsigned for v1. Users see a SmartScreen warning
  the first time. The Download page now states this explicitly.
- **Linux**: not required.
