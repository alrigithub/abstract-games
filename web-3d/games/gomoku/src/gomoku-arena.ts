import { GOMOKU_DIMS, gomokuCellWorld } from '@abstract/three-engine';

/** Documented SHA-256 of the committed arena in `web-3d/lib/maps/go-map.glb`. */
export const GOMOKU_ARENA_GLB_SHA256 =
  '46961529a2514079e43142a9deb30f3c94b3a4cf1e1725a6b24c015749fb53a2';
export const GOMOKU_ARENA_GLB_FILE = 'go-map.glb';

/** Real-world tile pitch (150 mm) mapped to one world unit per intersection. */
export const GOMOKU_ARENA_TILE_PITCH_M = 0.15;
/** Cell node spacing in the GLB export (7× the 150 mm pitch, in meters). */
export const GOMOKU_ARENA_AUTHORED_PITCH_M = 1.05;
/** Maps authored GLB meters → world units (one unit per intersection). */
export const GOMOKU_ARENA_WORLD_SCALE = 1 / GOMOKU_ARENA_AUTHORED_PITCH_M;

/** Playfield half-span: 7 × {@link GOMOKU_ARENA_TILE_PITCH_M} = 1.05 m. */
export const GOMOKU_ARENA_FIELD_HALF_M = 1.05;
/** Outer corner cell translation magnitude in authored GLB space. */
export const GOMOKU_ARENA_AUTHORED_FIELD_HALF_M = 7.35;

export function gomokuArenaCellAuthoredXz(row: number, col: number): { x: number; z: number } {
  const half = GOMOKU_ARENA_AUTHORED_FIELD_HALF_M;
  const pitch = GOMOKU_ARENA_AUTHORED_PITCH_M;
  return { x: -half + col * pitch, z: half - row * pitch };
}

/** World XZ of a cell centre after scale + Z flip. `y` is the world Z. */
export function gomokuArenaCellWorldXz(row: number, col: number): { x: number; y: number } {
  const { x, z } = gomokuArenaCellAuthoredXz(row, col);
  const s = GOMOKU_ARENA_WORLD_SCALE;
  return { x: x * s, y: -z * s };
}

export function gomokuArenaPlacementError(row: number, col: number): number {
  const target = gomokuCellWorld(GOMOKU_DIMS.GRID, row, col);
  const arena = gomokuArenaCellWorldXz(row, col);
  return Math.hypot(arena.x - target.x, arena.y - target.z);
}
