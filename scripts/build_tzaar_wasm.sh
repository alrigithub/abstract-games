#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/web-pixi/tzaar/public/wasm"
WASM_BINDGEN_VERSION="0.2.106"
TARGET_ROOT="${CARGO_TARGET_DIR:-${ROOT}/target}"
if [[ "${TARGET_ROOT}" != /* ]]; then
  TARGET_ROOT="${ROOT}/${TARGET_ROOT}"
fi
WASM_BIN="${TARGET_ROOT}/wasm32-unknown-unknown/wasm-release/tzaar_wasm.wasm"

cd "$ROOT"

if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
  rustup target add wasm32-unknown-unknown
fi

if ! wasm-bindgen --version 2>/dev/null | grep -q "$WASM_BINDGEN_VERSION"; then
  echo "Installing wasm-bindgen-cli ${WASM_BINDGEN_VERSION}..."
  cargo install wasm-bindgen-cli --version "${WASM_BINDGEN_VERSION}" --locked --force
fi

export RUSTFLAGS='--cfg getrandom_backend="wasm_js"'

echo "==> cargo build tzaar_wasm (wasm-release)"
cargo build --profile wasm-release --target wasm32-unknown-unknown -p tzaar_wasm

mkdir -p "$OUT"
echo "==> wasm-bindgen -> ${OUT}/"
wasm-bindgen \
  --out-dir "$OUT" \
  --target web \
  --no-typescript \
  "${WASM_BIN}"

if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -Os "${OUT}/tzaar_wasm_bg.wasm" -o "${OUT}/tzaar_wasm_bg.wasm"
fi

echo "Done. WASM bundle in ${OUT}/"
