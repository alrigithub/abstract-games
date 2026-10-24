# @abstract/pixi-shared

Shared Pixi v8 helpers for abstract-games web clients.

- **`pixi-stage/`** — camera, hit testing, pointer policy, and palette (from BimSavage `lib/pixi-stage`, aligned with Boop/Gomoku ports).
- **Theme / VFX** — Yinsh light tokens, animated stage background, win glow + dust.
- **Hex boards** — layout + grid drawing for Yinsh and Tzaar sloped grids.
- **AI HUD + worker bridge** — strength control and Web Worker move requests.

Games import `@abstract/pixi-shared` from the `web-pixi` npm workspace.
