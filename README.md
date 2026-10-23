# Abstract Games

A Rust Cargo **monorepo** of abstract board games with human-vs-AI play (offline). The first game is [Yinsh](http://en.wikipedia.org/wiki/Yinsh), imported from [sharkdp/yinsh](https://github.com/sharkdp/yinsh); [Gomoku](https://en.wikipedia.org/wiki/Gomoku) and [Boop](https://boardgamegeek.com/boardgame/318084/boop) are planned next.

**Stack:** Bevy 0.17 desktop and WASM builds, async minimax AI, piece tweens — same feel as upstream Yinsh.

Agent and contributor guidance: [AGENTS.md](./AGENTS.md).

## Games

| Game | Status | Crates |
|------|--------|--------|
| Yinsh | playable | `yinsh`, `yinsh_ai`, `yinsh_gui`, `yinsh_ai_eval` |
| Gomoku | planned | `crates/gomoku*` |
| Boop | planned | `crates/boop*` |

## Yinsh

Implementation of Yinsh with a strong AI. Rules: [Wikipedia — Yinsh](http://en.wikipedia.org/wiki/Yinsh#Rules).

[**Play in your browser**](http://david-peter.de/yinsh) (upstream deployment; rebuild locally with `deploy.sh`).

<img width="1103" height="1104" alt="Yinsh screenshot" src="https://github.com/user-attachments/assets/fc02bf84-5266-4a90-987a-95c71fac28e2" />

### Desktop

```bash
cargo run -p yinsh_gui
```

### Key bindings (Yinsh)

| Key | Action | Web | Desktop |
|-----|--------|:---:|:-------:|
| `U` / `Ctrl+Z` | Undo | ✓ | ✓ |
| `Ctrl+R` | Reset game | ✓ | ✓ |
| `PageDown` / `PageUp` | Decrease / Increase AI strength | ✓ | ✓ |
| `Ctrl+S` | Save game state | | ✓ |
| `Ctrl+L` | Load game state | | ✓ |
| `Escape` / `Q` | Quit | | ✓ |

## Development

```bash
cargo test
cargo clippy --workspace
cargo fmt --check
```

## Attribution

Yinsh game logic, AI, and GUI are derived from [sharkdp/yinsh](https://github.com/sharkdp/yinsh) by David Peter and contributors. See [NOTICE](./NOTICE). Licensed under **MIT OR Apache-2.0** ([LICENSE-MIT](./LICENSE-MIT), [LICENSE-APACHE](./LICENSE-APACHE)).
