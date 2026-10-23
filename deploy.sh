#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "Building WASM bundles into web/{yinsh,gomoku,boop,tak}/ ..."
"${ROOT}/scripts/build_web.sh"

cat <<'NOTE'

Static site layout:
  web/index.html          — hub
  web/yinsh/index.html  — Yinsh (WASM)
  web/gomoku/index.html — Gomoku (WASM)
  web/boop/index.html   — Boop (WASM)
  web/tak/index.html    — Tak (WASM)

Serve locally:
  python3 -m http.server 8080 --directory web

Deploy: upload the web/ directory to your static host (GitHub Pages, S3, etc.).
Upstream Yinsh used a separate Nix deploy on pink-nixos; this repo uses scripts/build_web.sh.
NOTE
