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

### Pixi web clients (`web-pixi/`)

npm workspace: `shared` (`@abstract/pixi-shared`, from BimSavage `lib/pixi-stage` + Yinsh light-theme VFX/HUD helpers), plus per-game Vite apps.

**Yinsh** — `web-pixi/yinsh/` (Rust `yinsh_wasm`, AI Web Worker). Output: `web/yinsh-pixi/`.

**Boop** — `web-pixi/boop/` (TypeScript rules/AI from BimSavage `games/boop`, AI Web Worker). Output: `web/boop-pixi/`.

```bash
cd web-pixi && npm install
./scripts/build_yinsh_wasm.sh
npm run build -w yinsh-pixi
npm run build -w boop-pixi
# Playwright: npm run test:e2e:ci -w yinsh-pixi && npm run test:e2e:ci -w boop-pixi
```

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
