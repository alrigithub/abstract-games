import {
  boopPieceGeometrySet,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createSquareTopology,
  readStoredTheme,
  storeTheme,
  type BoardSnapshot,
  type EnginePiece,
  type ReserveSlot,
  type SceneApi,
  type ThemeId,
} from '@abstract/three-engine';

const size = 6;
const cat = createBoopCatGeometry();
const kitten = createBoopKittenGeometry();
const pieces = boopPieceGeometrySet(cat, kitten);
const topology = createSquareTopology({ size });

/** Side reserve pools (left = A, right = B) flanking the 6×6 bed. */
function boopReservePools(): ReserveSlot[] {
  const sideX = size / 2 + 1.35;
  return [
    { id: 'a-kittens', player: 'A', shape: 'kitten', pile: 0, position: { x: -sideX, z: -0.85 }, count: 6 },
    { id: 'a-cats', player: 'A', shape: 'cat', pile: 0, position: { x: -sideX, z: 0.85 }, count: 2 },
    { id: 'b-kittens', player: 'B', shape: 'kitten', pile: 0, position: { x: sideX, z: -0.85 }, count: 6 },
    { id: 'b-cats', player: 'B', shape: 'cat', pile: 0, position: { x: sideX, z: 0.85 }, count: 2 },
  ];
}

/** Midgame layout loosely matching the Astra B&W Boop mockup. */
function mockupPieces(): EnginePiece[][] {
  const cells: EnginePiece[][] = Array.from({ length: size * size }, () => []);
  const at = (row: number, col: number, piece: EnginePiece) => {
    cells[row * size + col]!.push(piece);
  };
  at(2, 2, { id: 'w-cat-1', player: 'A', shape: 'cat' });
  at(2, 3, { id: 'b-kitten-1', player: 'B', shape: 'kitten' });
  at(3, 2, { id: 'b-cat-1', player: 'B', shape: 'cat' });
  at(3, 3, { id: 'w-kitten-1', player: 'A', shape: 'kitten' });
  at(2, 4, { id: 'b-kitten-2', player: 'B', shape: 'kitten' });
  at(4, 2, { id: 'w-cat-2', player: 'A', shape: 'cat' });
  at(4, 3, { id: 'w-kitten-2', player: 'A', shape: 'kitten' });
  return cells;
}

const snapshot: BoardSnapshot = {
  playableCells: size * size,
  cellCount: size * size,
  cells: mockupPieces(),
  reserves: boopReservePools(),
};

const board = document.querySelector<HTMLDivElement>('#board')!;
const scene = await createBoardScene(board, {
  gridSize: size,
  topology,
  pieces,
  initialTheme: readStoredTheme(),
});
scene.setSnapshot(snapshot);

declare global {
  interface Window {
    __boopScene?: SceneApi;
    __boopSetTheme?: (theme: ThemeId) => void;
  }
}

window.__boopScene = scene;
window.__boopSetTheme = (theme: ThemeId) => {
  storeTheme(theme);
  scene.setTheme(theme);
};

const params = new URLSearchParams(location.search);
const forcedTheme = params.get('theme');
if (forcedTheme === 'light' || forcedTheme === 'dark') {
  window.__boopSetTheme(forcedTheme);
}

board.dataset.ready = 'true';
