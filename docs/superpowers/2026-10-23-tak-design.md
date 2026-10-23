# Tak v1 Design (approved 2026-10-23)

Alex approved: Tak first, then Tzaar. Same Bevy 0.17 + minimax + WASM monorepo pattern as Yinsh/Gomoku/Boop.

## Scope
- Crates: `tak` (pure rules), `tak_ai` (minimax), `tak_gui` (Bevy human-vs-AI)
- Rules: standard Tak — flats, walls, caps; stacking; road win; **5×5 first**
- Out of scope v1: online multiplayer, PTN UI, Tzaar (next after Tak), board sizes other than 5×5
- Web: `web/tak/` + hub link when GUI works
- Repo: https://github.com/alrigithub/abstract-games — branch off current monorepo work (PR #1 / `cursor/gomoku-core-engine-a86d` or merged main)
