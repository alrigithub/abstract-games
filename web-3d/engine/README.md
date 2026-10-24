# @abstract/three-engine

Rules-agnostic Three.js board engine extracted from Alex's Tak studio. It owns the scene, orthographic camera + orbit/pan, raycast picking, hover ghosts, reserve trays, stack lift/split timing, and demand rendering.

## Quick start

```ts
import {
  createBoardScene,
  createInteraction,
  createSquareTopology,
  createTakPieceGeometries,
  takPieceGeometrySet,
  readStoredTheme,
} from '@abstract/three-engine';

const geos = createTakPieceGeometries();
const pieces = takPieceGeometrySet(geos);
const topology = createSquareTopology({ size: 5 });

const scene = await createBoardScene(container, {
  gridSize: 5,
  topology,
  pieces,
  initialTheme: readStoredTheme(),
});

const interaction = createInteraction({
  element: container,
  getSnapshot: () => snapshot,
  hitTest: (x, y) => scene.hitTest(x, y),
  hitReserve: (x, y) => scene.hitReserve(x, y),
  onView: view => scene.setInteraction(view),
  onCommit: (selection, target) => {
    if (rules.canDrop(snapshot, selection, target)) {
      snapshot = rules.applyDrop(snapshot, selection, target);
      scene.setSnapshot(snapshot);
    }
  },
});
```

## What you provide

| Hook | Role |
|------|------|
| `BoardSnapshot` | `cells[][]`, optional `reserves[]` tray slots beside the board |
| `PieceGeometrySet` | `geometry(piece)`, `height(piece)`, optional stable `yaw` |
| `Topology` | Map world XZ ↔ cell index (square grid helper included) |
| `GameRules` | `canDrop`, `applyDrop`, optional `toggleTop`, `legalTargets` |

Piece animation timings live in `constants.ts` (`ANIMATION`, `INTERACTION`) and match the original Tak project.

## Themes

Call `scene.setTheme('light' \| 'dark')`. Defaults follow `prefers-color-scheme`; persist with `storeTheme()` / `readStoredTheme()`.

## AI / remote moves

Use `scene.enqueueAnimation(async () => { … applyMove … scene.setSnapshot(next); })` so moves never overlap player drags.

## Demos

- `web-3d/tak` — full Tak vs AI
- `web-3d/demos/gomoku` — intersection board + Go lens stones
- `web-3d/demos/boop` — beveled crown cats / kitten cylinders
<<<<<<< HEAD
=======
- `web-3d/demos/tzaar` — GIPF-set chip + printed hex board (`gipf-set.ts`), 60-point Tzaar layout, stackable discs (Tott / Tzarra / Tzaar)
>>>>>>> e76a376 (Add shared GIPF-set chip and hex board for Tzaar and Yinsh.)
