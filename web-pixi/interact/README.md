# @abstract/pixi-interact

Pick-up-and-place engine for Abstract Pixi v8 games (Tak, Boop, Gomoku, Tzaar, Yinsh). Rules stay in each game; the engine handles pointers, trays, stacks, ghosts, and queued motion.

Piece silhouettes follow the approved **Astra B&W** mockups; table/board colors use tokenized **light (soft)** and **dark** themes (see below).

## Install (within monorepo)

```bash
cd web-pixi/interact
npm install
```

Peer dependency: `pixi.js` ^8.9.2.

## Demo

```bash
cd web-pixi/interact
npm run dev
# http://127.0.0.1:5175/
```

Preview (Playwright / CI):

```bash
npm run preview
# http://127.0.0.1:4175/
```

## Tests

```bash
npm run test:unit
npm run test:e2e
```

## Wiring a game

1. Create `InteractEngine` with board size and `cellPitchPx`.
2. Provide `InteractHooks`:
   - `getCells()` — piece ids per cell, bottom → top
   - `legalTargets(selection)` — rule-filtered cell indices
   - `canPick(source)` — cell or tray slot
   - `onCommit(selection, target)` — apply move in your rules crate; return `false` to bounce
3. Optionally call `animateMove()` for AI using the same pipeline as human commits.
4. Import theme tokens from `@abstract/pixi-interact` (`ASTRA_BW`, `drawPiece`, `lineWidthPx`, …).

```ts
import { InteractEngine, applyMoveSuffix, ASTRA_BW } from "@abstract/pixi-interact";

const engine = new InteractEngine({
  mount: document.getElementById("app")!,
  boardSize: 5,
  hooks: {
    getCells: () => myState.cells,
    legalTargets: (sel) => rules.legalTargets(myState, sel),
    canPick: (src) => rules.canPick(myState, src),
    onCommit: (sel, target) => {
      myState = rules.apply(myState, sel, target);
      return true;
    },
  },
});
```

## Themes

Two full `InteractTheme` objects — every draw path reads tokens only (live swap via `engine.setTheme(theme)`):

| Token | Light (soft) | Dark |
|---|---|---|
| `stageBg` | `#f3f1ec` | `#16171a` |
| `boardFill` | `#e8e4dc` | `#22242a` |
| `boardLine` | `#5c564c` | `#8a8f98` |
| `playerA` / ink | `#111111` / `#222222` | `#111111` / `#d0d0d0` |
| `playerB` / ink | `#f5f5f5` / `#222222` | `#f5f5f5` / `#222222` |
| `win` | `#3b82f6` (both) | same |
| `hover` | `#94a3b8` | `#94a3b8` |

Helpers: `LIGHT_SOFT_THEME`, `DARK_THEME`, `themeById`, `resolveInitialThemeId()`, `persistThemeId()`.

Demo: **Light/Dark** button + `localStorage` key `abstract-pixi-interact-theme`; default follows `prefers-color-scheme` when unset.

## Theme export (drawing)

- `drawPiece(g, kind, side, cellPitchPx, theme)` — oblique 2D silhouettes
- `TRAY_THEME` — minimal side reserve slots (proposal)
- `tak-feel-constants.ts` — motion timings (below)

## Motion constants (from Alex’s Three.js Tak)

| Constant | Value | Source |
|---|---:|---|
| `PIECE_MOVE_DURATION_MS` | 180 | `tak-src/src/scene.ts` `DURATION` |
| `PIECE_LIFT_DURATION_MS` | 150 | `scene.ts` `LIFT_DURATION` |
| `LIFT_WORLD_UNITS` | 0.28 | `scene.ts` `LIFT` |
| `STACK_FLOOR_WORLD_UNITS` | 0.018 | `scene.ts` `FLOOR` |
| `CARRIED_HORIZONTAL_DELAY_MS` | 85 | `scene.ts` `pickupAt + 85` |
| `CARRIED_HORIZONTAL_DURATION_MS` | 60 | `scene.ts` horizontal lerp divisor |
| `HOLD_INTERVAL_MS` | 400 | `tak-src/src/state.ts` `HOLD_INTERVAL` |
| `DRAG_THRESHOLD_PX` | 6 | `tak-src/src/interaction.ts` |
| Easing | cubic ease-out | `scene.ts` `1 - (1-t)³` |

2D-only helpers: `PLACE_SETTLE_DURATION_MS`, `SPREAD_STAGGER_MS`, `BOUNCE_BACK_DURATION_MS`, lift shadow/scale (`PICKUP_SCALE`, `PICKUP_TILT_RAD`).

Hold-to-split stack count uses `countSelectedHold()` — same formula as `countSelected()` in `state.ts`.

## Package layout

```
src/
  interact-engine.ts      # Pixi stage, board, trays, animation queue
  interaction/            # Pointer + hold-to-split (from tak interaction.ts)
  scheduler.ts            # Ticker-driven tween queue
  stack-model.ts          # Suffix stacks / hold count
  theme/astra-bw.ts       # Palette + tray proposal
  theme/piece-drawings.ts # Astra silhouettes in 2D
  tak-feel-constants.ts
demo/                     # Grid + trays + fake AI
e2e/                      # Playwright + screenshots
```
