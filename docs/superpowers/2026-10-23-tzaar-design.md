# Tzaar v1 Design (queued after Tak, 2026-10-23)

Same monorepo pattern as Tak/Gomoku/Boop. Alex order: Tak first, then Tzaar.

## Scope
- Crates: `tzaar`, `tzaar_ai`, `tzaar_gui` (Bevy 0.17 human-vs-AI)
- Rules: standard Tzaar (hex board, Tzaars/Tzaras/Totts, capture by height, stack to strengthen, win by eliminating type or no moves)
- Out of scope v1: online multiplayer, fancy tutorials
- Web: `web/tzaar/` + hub; CI wasm for `tzaar_gui`
- Base branch: stack on Tak branch `cursor/tak-v1-05df` (or updated main once merged)
