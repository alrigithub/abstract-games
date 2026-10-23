# Tzaar Bevy+WASM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Add playable human-vs-AI Tzaar to abstract-games with three crates + WASM hub, matching Tak/Gomoku/Boop.

**Architecture:** `tzaar` pure rules, `tzaar_ai` minimax, `tzaar_gui` Bevy 0.17. Mirror `crates/tak*` and `crates/boop*`.

**Tech Stack:** Rust 2024, Bevy 0.17, minimax 0.5.x, wasm-bindgen via existing `scripts/build_web.sh`.

## Global Constraints
- Do not break Yinsh/Gomoku/Boop/Tak.
- TDD for engine/AI; `cargo test --workspace` green.
- Start from `cursor/tak-v1-05df` (includes Tak).

### Task 1: `tzaar` core engine
- Full Tzaar rules: board, piece types, capture, stack, turn structure (capture then optional stack/second capture per official rules — verify against published rules), win conditions.
- Commit `feat(tzaar): core rules engine`

### Task 2: `tzaar_ai` minimax adapter + heuristic
- Commit `feat(tzaar_ai): minimax adapter`

### Task 3: `tzaar_gui` Bevy human-vs-AI
- Binary name `tzaar`; undo/reset/AI depth like siblings
- Commit `feat(tzaar_gui): Bevy human-vs-AI`

### Task 4: Web hub + CI
- `web/tzaar/`, hub link, `build_web.sh`, CI `-p tzaar_gui`
- Commit `feat(web): Tzaar WASM hub entry`

### Task 5: Close-out
- `cargo test --workspace`; open PR; commit plan/spec under docs/superpowers/
