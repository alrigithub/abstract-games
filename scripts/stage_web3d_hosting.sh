#!/usr/bin/env bash
# Build all web-3d game bundles and copy each dist/ into one staging tree for Firebase/static hosting.
# Upload the entire output directory atomically so index.html and hashed assets/ stay in sync.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/hosting-staging}"
WEB3D="$ROOT/web-3d"

rm -rf "$OUT"
mkdir -p "$OUT"

cd "$WEB3D"
npm run build -w @abstract/three-engine

build_and_copy() {
  local dir="$1"
  local dest_name="$2"
  (cd "$WEB3D/$dir" && npm run build)
  mkdir -p "$OUT/$dest_name"
  cp -a "$WEB3D/$dir/dist/." "$OUT/$dest_name/"
}

build_and_copy tak tak
build_and_copy demos/gomoku gomoku
# Boop: skip wasm rebuild when committed wasm/ is present (CI/local rust may differ).
if [[ -f "$WEB3D/demos/boop/wasm/boop_wasm_bg.wasm" ]]; then
  (cd "$WEB3D/demos/boop" && npx tsc --noEmit && npx vite build)
else
  npm run build -w boop-3d-demo
fi
mkdir -p "$OUT/boop"
cp -a "$WEB3D/demos/boop/dist/." "$OUT/boop/"
build_and_copy demos/yinsh yinsh
build_and_copy demos/tzaar tzaar

if [[ -f "$ROOT/web/index.html" ]]; then
  cp "$ROOT/web/index.html" "$OUT/index.html"
  [[ -d "$ROOT/web/rules-tldr" ]] && cp -a "$ROOT/web/rules-tldr" "$OUT/rules-tldr"
fi

echo "Staged web-3d hosting tree at: $OUT"
echo "Deploy by uploading the whole directory (not individual game folders)."
