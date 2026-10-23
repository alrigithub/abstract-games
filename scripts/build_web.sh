#!/usr/bin/env bash
# Build WASM web bundles for Yinsh, Gomoku, and Boop into web/{game}/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET=wasm32-unknown-unknown
PROFILE=wasm-release
export RUSTFLAGS='--cfg getrandom_backend="wasm_js"'

# Must match wasm-bindgen version in Cargo.lock (currently 0.2.106)
WASM_BINDGEN_VERSION="${WASM_BINDGEN_VERSION:-0.2.106}"
if ! wasm-bindgen --version 2>/dev/null | grep -q "$WASM_BINDGEN_VERSION"; then
  echo "Installing wasm-bindgen-cli ${WASM_BINDGEN_VERSION} (must match Cargo.lock)..."
  cargo install wasm-bindgen-cli --version "${WASM_BINDGEN_VERSION}" --locked --force
fi

rustup target add "${TARGET}" >/dev/null 2>&1 || true

build_game() {
  local pkg="$1"
  local bin="$2"
  local out_dir="web/${bin}"

  echo "==> cargo build -p ${pkg} (${PROFILE})"
  cargo build --profile "${PROFILE}" --target "${TARGET}" -p "${pkg}"

  mkdir -p "${out_dir}"
  echo "==> wasm-bindgen -> ${out_dir}/"
  wasm-bindgen \
    --out-dir "${out_dir}" \
    --target web \
    --no-typescript \
    "target/${TARGET}/${PROFILE}/${bin}.wasm"

  if command -v wasm-opt >/dev/null 2>&1; then
    wasm-opt -Os "${out_dir}/${bin}_bg.wasm" -o "${out_dir}/${bin}_bg.wasm"
  else
    echo "    (wasm-opt not found; skipping shrink step — install binaryen for smaller bundles)"
  fi
}

build_game yinsh_gui yinsh
build_game gomoku_gui gomoku
build_game boop_gui boop

echo "Done. Open web/index.html via a static server (e.g. python3 -m http.server --directory web)."
