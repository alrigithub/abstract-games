#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/web-pixi/gomoku/public/wasm"
WASM_BINDGEN_VERSION="0.2.106"

cd "$ROOT"

if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
  rustup target add wasm32-unknown-unknown
fi

if ! wasm-bindgen --version 2>/dev/null | grep -q "$WASM_BINDGEN_VERSION"; then
  echo "Installing wasm-bindgen-cli ${WASM_BINDGEN_VERSION}..."
  cargo install wasm-bindgen-cli --version "${WASM_BINDGEN_VERSION}" --locked --force
fi

export RUSTFLAGS='--cfg getrandom_backend="wasm_js"'

echo "==> cargo build gomoku_wasm (wasm-release)"
cargo build --profile wasm-release --target wasm32-unknown-unknown -p gomoku_wasm

mkdir -p "$OUT"
echo "==> wasm-bindgen -> ${OUT}/"
wasm-bindgen \
  --out-dir "$OUT" \
  --target web \
  --no-typescript \
  "${ROOT}/target/wasm32-unknown-unknown/wasm-release/gomoku_wasm.wasm"

if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -Os "${OUT}/gomoku_wasm_bg.wasm" -o "${OUT}/gomoku_wasm_bg.wasm"
fi

echo "Done. WASM bundle in ${OUT}/"
