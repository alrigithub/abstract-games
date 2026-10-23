# AGENTS.md

Guidance for coding agents working in this repository.

## Product

Rust Cargo **monorepo** of abstract board games. Human vs AI, offline.
Feel target: [sharkdp/yinsh](https://github.com/sharkdp/yinsh) — Bevy GUI, WASM web build, async minimax, tweens.
Not the BimSavage Next/Pixi shell. Not the abandoned Vite+Canvas2D hub.

## Games (priority)

1. Yinsh — upstream crates under `crates/yinsh*`
2. Gomoku — `crates/gomoku*` (planned)
3. Boop — `crates/boop*` (planned)

Later: Tak, Tzaar (out of scope until asked)

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
cargo test
cargo clippy --workspace
cargo fmt --check
cargo run -p yinsh_gui          # Yinsh desktop (binary: yinsh)
cargo run -p gomoku_gui         # Gomoku desktop (when added)
cargo run -p boop_gui           # Boop desktop (when added)
cargo run -p yinsh_ai_eval --release
# WASM: follow deploy.sh / web section below
```

## Patterns to copy (from yinsh)

- `TurnMode` / `Move` state machine in `{game}`
- `InteractionState` separate from `GameState` in GUI
- AI via `bevy_async_task` (never block the render loop)
- `bevy_tweening` ~500ms piece motion
- YAML fixtures for AI / midgame tests where useful

## Web / WASM

Build and deploy follow upstream `deploy.sh` for Yinsh. When Gomoku and Boop GUIs exist, extend the script so each `*_gui` crate emits into `web/{game}/`. Hub entry point: `web/index.html`.

## Do not

- Add online multiplayer in v1
- Port games to JS/Canvas2D engines
- Break `cargo test -p yinsh` / `cargo test -p yinsh_ai`
- Commit secrets or large binary assets without need
