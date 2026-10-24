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
build_and_copy demos/boop boop
build_and_copy demos/yinsh yinsh
build_and_copy demos/tzaar tzaar

if [[ -f "$WEB3D/hub/index.html" ]]; then
  cp "$WEB3D/hub/index.html" "$OUT/index.html"
  [[ -d "$WEB3D/hub/rules-tldr" ]] && cp -a "$WEB3D/hub/rules-tldr" "$OUT/rules-tldr"
fi

echo "Staged web-3d hosting tree at: $OUT"
echo "Deploy by uploading the whole directory (not individual game folders)."
