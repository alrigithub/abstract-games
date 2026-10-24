import {
  boopPieceGeometrySet,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createSquareTopology,
  readStoredTheme,
} from '@abstract/three-engine';
import type { BoardSnapshot } from '@abstract/three-engine';

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
const scene = await createBoardScene(board, { gridSize: size, topology, pieces, initialTheme: readStoredTheme() });
scene.setSnapshot(snapshot);
