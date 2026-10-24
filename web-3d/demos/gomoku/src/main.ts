import {
  createBoardScene,
  createGomokuStoneGeometry,
  createSquareTopology,
  gomokuPieceGeometrySet,
  bindThemeToggle,
  readStoredTheme,
} from '@abstract/three-engine';
import type { BoardSnapshot, EnginePiece } from '@abstract/three-engine';

const size = 15;
const stone = createGomokuStoneGeometry();
const pieces = gomokuPieceGeometrySet(stone);
const topology = createSquareTopology({ size });

const cells: EnginePiece[][] = Array.from({ length: size * size }, () => []);
const sample: EnginePiece[] = [
  { id: 'b1', player: 'B', shape: 'stone' },
  { id: 'w1', player: 'A', shape: 'stone' },
  { id: 'b2', player: 'B', shape: 'stone' },
];
cells[7 * size + 7] = [sample[0]!];
cells[7 * size + 8] = [sample[1]!];
cells[8 * size + 7] = [sample[2]!];

const snapshot: BoardSnapshot = { playableCells: size * size, cellCount: size * size, cells };

const board = document.querySelector<HTMLDivElement>('#board')!;
const scene = await createBoardScene(board, {
  gridSize: size,
  topology,
  pieces,
  initialTheme: readStoredTheme(),
});
scene.setSnapshot(snapshot);
bindThemeToggle(document.querySelector('#theme-toggle')!, t => scene.setTheme(t));
