import {
  boopPieceGeometrySet,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createGameButtons,
  createSquareTopology,
  readInitialTheme,
  type BoardSnapshot,
  type ThemeId,
} from '@abstract/three-engine';

const size = 6;
const cat = createBoopCatGeometry();
const kitten = createBoopKittenGeometry();
const pieces = boopPieceGeometrySet(cat, kitten);
const topology = createSquareTopology({ size });

const cells = Array.from({ length: size * size }, () => [] as import('@abstract/three-engine').EnginePiece[]);
cells[2 * size + 2] = [{ id: 'cat1', player: 'A', shape: 'cat' }];
cells[2 * size + 3] = [{ id: 'k1', player: 'B', shape: 'kitten' }];
cells[3 * size + 2] = [{ id: 'cat2', player: 'B', shape: 'cat' }];

const snapshot: BoardSnapshot = { playableCells: size * size, cellCount: size * size, cells };
const board = document.querySelector<HTMLDivElement>('#board')!;
let theme: ThemeId = readInitialTheme();

const scene = await createBoardScene(board, { gridSize: size, topology, pieces, initialTheme: theme });
scene.setSnapshot(snapshot);

function applyTheme(id: ThemeId) {
  theme = id;
  scene.setTheme(id);
}

const cameraViews = scene.createCameraViews();

createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  cameraViews,
  applyTheme,
  onNewGameReset: () => scene.setSnapshot(snapshot),
});
