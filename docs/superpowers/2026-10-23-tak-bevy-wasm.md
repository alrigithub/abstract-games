# Tak Bevy+WASM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add playable human-vs-AI Tak (5×5) to `alrigithub/abstract-games` with the same three-crate Bevy + minimax + WASM pattern as Gomoku/Boop.

**Architecture:** Pure `tak` rules engine (no Bevy), `tak_ai` minimax adapter + heuristics, `tak_gui` Bevy 0.17 app with async AI and tweens. Mirror `crates/gomoku*` / `crates/boop*` structure and `web/` hub wiring from Task 7.

**Tech Stack:** Rust 2024, Cargo workspace, Bevy 0.17, bevy_tweening 0.14, bevy_async_task 0.11, minimax 0.5.x, wasm-bindgen (same as existing `scripts/build_web.sh`).

## Global Constraints

- Follow existing AGENTS.md and workspace layout; do not break Yinsh/Gomoku/Boop.
- Board size v1: **5×5 only**.
- Offline human-vs-AI only.
- Tzaar is out of scope for this plan.
- TDD: write failing tests before rules/AI code; `cargo test -p tak` / `-p tak_ai` must pass before GUI.
- Start from branch that already has Gomoku+Boop (`cursor/gomoku-core-engine-a86d` or updated `main`).

### Task 1: `tak` core engine (5×5)

**Files:**
- Create: `crates/tak/Cargo.toml`, `crates/tak/src/lib.rs`, tests under `crates/tak/src/` or `tests/`
- Modify: root `Cargo.toml` workspace members

**Produces:** Place flat/wall/cap, move stacks (carry limit), flatten walls with capstone, road-win detection, reserve counts for 5×5.

- [ ] Step 1: Add crate + failing tests for empty board, legal place, illegal place on occupied
- [ ] Step 2: Implement place + reserves; tests pass
- [ ] Step 3: Failing tests for stack moves / slides / carry
- [ ] Step 4: Implement movement; tests pass
- [ ] Step 5: Failing tests for road win (orthogonal path of controlled flats/caps)
- [ ] Step 6: Implement win + game-over; tests pass
- [ ] Step 7: Commit `feat(tak): 5x5 core rules engine`

### Task 2: `tak_ai` minimax

**Files:** Create `crates/tak_ai/*` mirroring `gomoku_ai` / `boop_ai`

- [ ] Step 1: Failing tests for Game/Move trait adapters
- [ ] Step 2: Implement adapter + simple heuristic (road threats, flat count)
- [ ] Step 3: `cargo test -p tak_ai`; commit `feat(tak_ai): minimax adapter`

### Task 3: `tak_gui` Bevy human-vs-AI

**Files:** Create `crates/tak_gui/*` mirroring `boop_gui` / `gomoku_gui` (async AI, tweens, keyboard undo/reset/AI depth)

- [ ] Step 1: Scaffold Bevy app; place + move UX for 5×5
- [ ] Step 2: Wire async AI opponent
- [ ] Step 3: `cargo check -p tak_gui`; commit `feat(tak_gui): Bevy human-vs-AI`

### Task 4: Web hub + CI

**Files:** `web/tak/index.html`, `web/index.html`, `scripts/build_web.sh`, `.github/workflows/ci.yml`, `AGENTS.md`

- [ ] Step 1: Add web shell + build_game tak_gui tak
- [ ] Step 2: CI wasm-release for tak_gui
- [ ] Step 3: Commit `feat(web): Tak WASM hub entry`

### Task 5: Close-out

- [ ] `cargo test --workspace`
- [ ] Open/update PR; note Tzaar next
