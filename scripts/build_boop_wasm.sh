#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET=wasm32-unknown-unknown
PROFILE=wasm-release
OUT="${1:-web-3d/demos/boop/wasm}"
export RUSTFLAGS='--cfg getrandom_backend="wasm_js"'

WASM_BINDGEN_VERSION="${WASM_BINDGEN_VERSION:-0.2.106}"
if ! wasm-bindgen --version 2>/dev/null | grep -q "$WASM_BINDGEN_VERSION"; then
  cargo install wasm-bindgen-cli --version "${WASM_BINDGEN_VERSION}" --locked --force
fi

rustup target add "${TARGET}" >/dev/null 2>&1 || true

cargo build --profile "${PROFILE}" --target "${TARGET}" -p boop_wasm
mkdir -p "${OUT}"
wasm-bindgen \
  --out-dir "${OUT}" \
  --target web \
  --no-typescript \
  "target/${TARGET}/${PROFILE}/boop_wasm.wasm"

if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -Os "${OUT}/boop_wasm_bg.wasm" -o "${OUT}/boop_wasm_bg.wasm"
fi

echo "Boop WASM -> ${OUT}/"
