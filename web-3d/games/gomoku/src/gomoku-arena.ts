import {
  BOARD,
  GOMOKU_DIMS,
  applyArenaGlbThemeMaterials,
  gomokuCellWorld,
  loadGltfAsync,
  tagArenaGlbForShadows,
  tagExcludeFromBounds,
  type ThemeId,
} from '@abstract/three-engine';
import * as THREE from 'three';
import { PropertyBinding } from 'three';

/** Documented SHA-256 of the committed arena in `public/models/` (any encoding). */
export const GOMOKU_ARENA_GLB_SHA256 =
  'c9039302c8ae352efd8a1ed3aaa28b8587a4168a8d7fa46f2a1e849e1681e6fa';
export const GOMOKU_ARENA_GLB_FILE = 'arena-15x15-white-150mm.glb';

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

const INFINITE_GROUND_RAW = 'Infinite white ground';
const INFINITE_GROUND_SANITIZED = PropertyBinding.sanitizeNodeName(INFINITE_GROUND_RAW);

const _box = new THREE.Box3();

export interface GomokuArenaLayout {
  readonly root: THREE.Group;
  surfaceY(row: number, col: number): number;
  frameBounds(): THREE.Box3;
  setTheme(themeId: ThemeId): void;
}

function arenaAssetUrl(): string {
  const base = import.meta.env.BASE_URL ?? './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const origin = globalThis.location?.href ?? 'http://127.0.0.1/';
  return new URL(`${prefix}models/${GOMOKU_ARENA_GLB_FILE}`, origin).href;
}

function isInfiniteGroundNode(obj: THREE.Object3D): boolean {
  return obj.name === INFINITE_GROUND_RAW || obj.name === INFINITE_GROUND_SANITIZED;
}

function readCellIndices(node: THREE.Object3D): { row: number; col: number } | null {
  const extras = node.userData as { row?: number; column?: number };
  if (typeof extras.row === 'number' && typeof extras.column === 'number') {
    return { row: extras.row, col: extras.column };
  }
  return null;
}

function tileTopYWorld(mesh: THREE.Object3D): number {
  _box.setFromObject(mesh);
  return _box.max.y;
}

function buildSurfaceMap(root: THREE.Group): Map<string, number> {
  const map = new Map<string, number>();
  root.traverse(node => {
    if (!(node as THREE.Mesh).isMesh || !node.name.startsWith('Cell')) return;
    const idx = readCellIndices(node);
    if (!idx) return;
    map.set(`${idx.row},${idx.col}`, tileTopYWorld(node));
  });
  return map;
}

function applyArenaTransform(root: THREE.Group): void {
  const s = GOMOKU_ARENA_WORLD_SCALE;
  root.scale.set(s, s, -s);
  root.updateMatrixWorld(true);
}

function alignArenaVertical(root: THREE.Group, surfaceByCell: Map<string, number>): void {
  const centerKey = `${Math.floor(GOMOKU_DIMS.GRID / 2)},${Math.floor(GOMOKU_DIMS.GRID / 2)}`;
  const centerTop = surfaceByCell.get(centerKey);
  if (centerTop === undefined) return;
  root.position.y = BOARD.PLAYFIELD_SURFACE_Y - centerTop;
  root.updateMatrixWorld(true);
}

function prepareArenaScene(scene: THREE.Group, themeId: ThemeId): THREE.Group {
  tagExcludeFromBounds(scene);
  const remove: THREE.Object3D[] = [];
  scene.traverse(obj => {
    if (isInfiniteGroundNode(obj)) remove.push(obj);
  });
  for (const obj of remove) obj.parent?.remove(obj);

  applyArenaGlbThemeMaterials(scene, themeId);
  tagArenaGlbForShadows(scene);
  return scene;
}

export function gomokuArenaCellAuthoredXz(row: number, col: number): { x: number; z: number } {
  const half = GOMOKU_ARENA_AUTHORED_FIELD_HALF_M;
  const pitch = GOMOKU_ARENA_AUTHORED_PITCH_M;
  return { x: -half + col * pitch, z: half - row * pitch };
}

/** World XZ of a cell centre after scale + Z flip (before root Y shift). */
export function gomokuArenaCellWorldXz(row: number, col: number): THREE.Vector2 {
  const { x, z } = gomokuArenaCellAuthoredXz(row, col);
  const s = GOMOKU_ARENA_WORLD_SCALE;
  return new THREE.Vector2(x * s, -z * s);
}

export function gomokuArenaPlacementError(row: number, col: number): number {
  const target = gomokuCellWorld(GOMOKU_DIMS.GRID, row, col);
  const arena = gomokuArenaCellWorldXz(row, col);
  return Math.hypot(arena.x - target.x, arena.y - target.z);
}

export async function loadGomokuArenaLayout(initialTheme: ThemeId = 'light'): Promise<GomokuArenaLayout> {
  const gltf = await loadGltfAsync(arenaAssetUrl());
  const root = prepareArenaScene(gltf.scene, initialTheme);
  root.name = 'gomoku-arena-15x15';
  applyArenaTransform(root);

  let surfaceByCell = buildSurfaceMap(root);
  alignArenaVertical(root, surfaceByCell);
  surfaceByCell = buildSurfaceMap(root);

  const fallbackY = BOARD.PLAYFIELD_SURFACE_Y;

  return {
    root,
    surfaceY(row, col) {
      return surfaceByCell.get(`${row},${col}`) ?? fallbackY;
    },
    frameBounds() {
      _box.setFromObject(root);
      return _box.clone();
    },
    setTheme(themeId: ThemeId) {
      applyArenaGlbThemeMaterials(root, themeId);
    },
  };
}
