import {
  boopPieceGeometrySet,
  cellIndex,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createSquareTopology,
  bindThemeToggle,
  readStoredTheme,
  storeTheme,
  type BoardSnapshot,
  type EnginePiece,
  type SceneApi,
  type ThemeId,
} from '@abstract/three-engine';

const size = 6;
/** Exterior ring columns for side pools (framed via Topology.frameCorners on the base engine). */
const OUTSIDE_ROWS = 2;
const cellTotal = (size + OUTSIDE_ROWS * 2) ** 2;

const cat = createBoopCatGeometry();
const kitten = createBoopKittenGeometry();
const pieces = boopPieceGeometrySet(cat, kitten);
const topology = createSquareTopology({ size, outsideRows: OUTSIDE_ROWS });

function pushStack(
  cells: EnginePiece[][],
  row: number,
  col: number,
  player: 'A' | 'B',
  shape: 'cat' | 'kitten',
  count: number,
  prefix: string,
) {
  const index = cellIndex(size, row, col, OUTSIDE_ROWS);
  if (index === null) return;
  for (let i = 0; i < count; i++) {
    cells[index]!.push({ id: `${prefix}-${i}`, player, shape });
  }
}

/** Side pools on exterior cells (left = A, right = B). */
function sidePoolStacks(cells: EnginePiece[][]) {
  const leftCol = -2;
  const rightCol = size + 1;
  pushStack(cells, 3, leftCol, 'A', 'kitten', 4, 'pool-a-k');
  pushStack(cells, 5, leftCol, 'A', 'cat', 2, 'pool-a-c');
  pushStack(cells, 3, rightCol, 'B', 'kitten', 4, 'pool-b-k');
  pushStack(cells, 5, rightCol, 'B', 'cat', 2, 'pool-b-c');
}

/** Midgame layout loosely matching the Astra B&W Boop mockup. */
function mockupPieces(cells: EnginePiece[][]) {
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
}

function buildSnapshot(): BoardSnapshot {
  const cells: EnginePiece[][] = Array.from({ length: cellTotal }, () => []);
  mockupPieces(cells);
  sidePoolStacks(cells);
  return {
    playableCells: size * size,
    cellCount: cellTotal,
    cells,
  };
}

const snapshot = buildSnapshot();
const board = document.querySelector<HTMLDivElement>('#board')!;

const scene = await createBoardScene(board, {
  gridSize: size,
  topology,
  pieces,
  initialTheme: readStoredTheme(),
});
scene.setSnapshot(snapshot);

bindThemeToggle(document.querySelector('#theme-toggle')!, t => scene.setTheme(t));

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
  document.documentElement.dataset.theme = theme;
};

const params = new URLSearchParams(location.search);
const forcedTheme = params.get('theme');
if (forcedTheme === 'light' || forcedTheme === 'dark') {
  window.__boopSetTheme(forcedTheme);
}

board.dataset.ready = 'true';
