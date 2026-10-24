# AGENTS.md

Guidance for coding agents working in this repository.

## Product

Rust Cargo **monorepo** of abstract board games. Human vs AI, offline.
Feel target: [sharkdp/yinsh](https://github.com/sharkdp/yinsh) — Bevy GUI, WASM web build, async minimax, tweens.
Not the BimSavage Next/Pixi shell. Not the abandoned Vite+Canvas2D hub.

## Games (priority)

1. Yinsh — `crates/yinsh*`
2. Gomoku — `crates/gomoku*`
3. Boop — `crates/boop*`
4. Tak — `crates/tak*` (5×5 v1)

Later: Tzaar (out of scope until asked)

## Workspace layout

Each game is three crates (four if eval exists):

| Crate | Role |
|-------|------|
| `{game}` | Pure rules + state machine. No Bevy. |
| `{game}_ai` | `minimax` crate adapter + heuristics |
| `{game}_gui` | Bevy 0.17 app bin; async AI; tweens |
| `{game}_ai_eval` | Optional AI tournament binary |

## Commands

```bash
cargo test --workspace
cargo clippy --workspace
cargo fmt --check
cargo run -p yinsh_gui          # desktop binary: yinsh
cargo run -p gomoku_gui         # desktop binary: gomoku
cargo run -p boop_gui           # desktop binary: boop
cargo run -p tak_gui            # desktop binary: tak
cargo run -p yinsh_ai_eval --release
```

## Web / WASM

Hub: `web/index.html` → `web/yinsh/`, `web/gomoku/`, `web/boop/`, `web/tak/`.

**Prerequisites:** `rustup target add wasm32-unknown-unknown`, and `wasm-bindgen-cli` **0.2.106** (must match `Cargo.lock`).

```bash
# One-shot (recommended)
./scripts/build_web.sh
# or
./deploy.sh

# Manual equivalent
export RUSTFLAGS='--cfg getrandom_backend="wasm_js"'
cargo build --profile wasm-release --target wasm32-unknown-unknown \
  -p yinsh_gui -p gomoku_gui -p boop_gui -p tak_gui
wasm-bindgen --out-dir web/yinsh --target web --no-typescript \
  target/wasm32-unknown-unknown/wasm-release/yinsh.wasm
wasm-bindgen --out-dir web/gomoku --target web --no-typescript \
  target/wasm32-unknown-unknown/wasm-release/gomoku.wasm
wasm-bindgen --out-dir web/boop --target web --no-typescript \
  target/wasm32-unknown-unknown/wasm-release/boop.wasm
wasm-bindgen --out-dir web/tak --target web --no-typescript \
  target/wasm32-unknown-unknown/wasm-release/tak.wasm
# Optional: wasm-opt -Os web/{game}/{game}_bg.wasm -o web/{game}/{game}_bg.wasm
```

Serve locally:

```bash
python3 -m http.server 8080 --directory web
# open http://localhost:8080/
```

Generated artifacts (`*_bg.wasm`, `*.js` in game folders) are gitignored; CI compiles WASM but does not commit bundles.

## Patterns to copy (from yinsh)

- `TurnMode` / `Move` state machine in `{game}`
- `InteractionState` separate from `GameState` in GUI
- AI via `bevy_async_task` (never block the render loop)
- `bevy_tweening` ~500ms piece motion
- YAML fixtures for AI / midgame tests where useful

## Do not

- Add online multiplayer in v1
- Port games to JS/Canvas2D engines
- Break `cargo test -p yinsh` / `cargo test -p yinsh_ai`
- Commit secrets or large binary assets without need

## Cursor Cloud specific instructions

- Build with current stable Rust (`rustup default stable`, with `rustfmt`, `clippy`, and the `wasm32-unknown-unknown` target). Edition 2024 and Bevy 0.17 need that toolchain. The image's preinstalled Rust 1.83 cannot compile this workspace.
- Host packages for Bevy, matching CI plus what a window needs here: `pkg-config`, `libasound2-dev`, `libudev-dev`, `libwayland-dev`, `libxkbcommon-dev`, `libxkbcommon-x11-0`, `libx11-dev`, and `mesa-vulkan-drivers` (lavapipe).
- `wasm-bindgen` **0.2.106** must be on `PATH` so it matches `Cargo.lock`. `/usr/local/bin/wasm-bindgen` is the right place.
- `cargo fetch` rewrites `Cargo.lock` because the lockfile still lists `bevy_tweening` under `tzaar_gui`, and that crate does not depend on it. `cargo test --workspace` follows CI and does not pass `--locked`. Restore `Cargo.lock` after a fetch when the worktree should stay clean.
- CI checks are `cargo test --workspace` and `cargo clippy --workspace --all-targets`. `cargo fmt --check` reports existing formatting diffs on `main`.
- `cargo run -p yinsh_gui` opens a window on lavapipe, then panics: cameras use `Msaa::Sample8` with `Hdr`, and llvmpipe allows at most 4 samples for `Rgba16Float`. This VM also has no ALSA device, so Bevy logs a missing audio output before that panic.
- Play through the browser. A dev WASM build is enough to place a ring:

```bash
export RUSTFLAGS='--cfg getrandom_backend="wasm_js"'
cargo build --target wasm32-unknown-unknown -p yinsh_gui
wasm-bindgen --out-dir web/yinsh --target web --no-typescript \
  target/wasm32-unknown-unknown/debug/yinsh.wasm
python3 -m http.server 8080 --directory web
# http://127.0.0.1:8080/yinsh/
```

`./scripts/build_web.sh` is the optimized build for every game.
