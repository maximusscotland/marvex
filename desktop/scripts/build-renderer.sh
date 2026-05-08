#!/usr/bin/env bash
# Builds the React frontend and copies it into desktop/renderer/ so the
# Electron main process can load it from disk via file://.
#
# Required env at build time:
#   REACT_APP_BACKEND_URL → the public backend the desktop app talks to
#                           (AI calls, cloud sync, Stripe). Must be HTTPS.
#                           e.g. https://marvex.app
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
RENDERER_DIR="$ROOT_DIR/desktop/renderer"

if [[ -z "${REACT_APP_BACKEND_URL:-}" ]]; then
  echo "✗ REACT_APP_BACKEND_URL must be set when building the desktop renderer."
  echo "  e.g.  REACT_APP_BACKEND_URL=https://marvex.app yarn dist"
  exit 1
fi

# Tell react-router-dom to use HashRouter when loaded from file://.  App.js
# already does that automatically when window.location.protocol === 'file:'.
echo "→ Building frontend (REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL)"
cd "$FRONTEND_DIR"
# CI=false  — Create React App treats ESLint warnings as errors when CI=true
# (which GitHub Actions sets by default). The dependency-array warnings in our
# codebase are intentional (preventing extra re-runs) and don't justify killing
# a release build, so we explicitly downgrade them back to warnings here.
CI=false REACT_APP_BACKEND_URL="$REACT_APP_BACKEND_URL" PUBLIC_URL="." yarn build

echo "→ Copying build → $RENDERER_DIR"
rm -rf "$RENDERER_DIR"
mkdir -p "$RENDERER_DIR"
cp -R "$FRONTEND_DIR/build/"* "$RENDERER_DIR/"

echo "✓ Renderer ready at $RENDERER_DIR"
