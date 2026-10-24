import {
  BOARD,
  applyArenaGlbThemeMaterials,
  createYinshTopology,
  loadGltfAsync,
  tagArenaGlbForShadows,
  tagExcludeFromBounds,
  yinshCoordKey,
  yinshWorldPoint,
  type BoardSnapshot,
  type ThemeId,
  type Topology,
  type YinshCoord,
} from '@abstract/three-engine';
import * as THREE from 'three';
import { PropertyBinding } from 'three';

/** Documented SHA-256 of the committed arena in `public/models/` (any encoding). */
export const YINSH_ARENA_GLB_SHA256 =
  'acbd4dfafa8eea1860efbe2c013a146832e17b18cff0b9a40530169e620837da';
export const YINSH_ARENA_GLB_FILE = 'yinsh-white-epic.glb';

const INFINITE_GROUND_RAW = 'Infinite white ground';
const INFINITE_GROUND_SANITIZED = PropertyBinding.sanitizeNodeName(INFINITE_GROUND_RAW);

/** Yinsh arena keeps Blender-authored PBR; pieces use shared clay. */
const YINSH_ARENA_KEEP_GLB_MATERIALS = { keepGlbMaterials: true as const };

const _box = new THREE.Box3();
const _raycaster = new THREE.Raycaster();
const _down = new THREE.Vector3(0, -1, 0);
const _origin = new THREE.Vector3();

function arenaAssetUrl(): string {
  const base = import.meta.env.BASE_URL ?? './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const origin = globalThis.location?.href ?? 'http://127.0.0.1/';
  return new URL(`${prefix}models/${YINSH_ARENA_GLB_FILE}`, origin).href;
}

function isInfiniteGroundNode(obj: THREE.Object3D): boolean {
  return obj.name === INFINITE_GROUND_RAW || obj.name === INFINITE_GROUND_SANITIZED;
}

function collectArenaMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse(node => {
    if (!(node as THREE.Mesh).isMesh) return;
    if (node.name.startsWith('Intersection_')) return;
    meshes.push(node as THREE.Mesh);
  });
  return meshes;
}

function raycastPlaySurfaceY(root: THREE.Object3D, x: number, z: number, meshes: THREE.Mesh[]): number | null {
  _raycaster.set(new THREE.Vector3(x, 50, z), _down);
  const hits = _raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  return hits[0]!.point.y;
}

function alignArenaVertical(root: THREE.Group, meshes: THREE.Mesh[]): void {
  const centerTop = raycastPlaySurfaceY(root, 0, 0, meshes);
  if (centerTop === null) return;
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

  applyArenaGlbThemeMaterials(scene, themeId, YINSH_ARENA_KEEP_GLB_MATERIALS);
  tagArenaGlbForShadows(scene);
  scene.name = 'yinsh-white-epic-arena';
  return scene;
}

export interface YinshArenaTemplate {
  readonly root: THREE.Group;
  surfaceY(coord: YinshCoord): number;
  frameBounds(): THREE.Box3;
  setTheme(themeId: ThemeId): void;
}

function buildSurfaceMap(root: THREE.Group, meshes: THREE.Mesh[]): Map<string, number> {
  const map = new Map<string, number>();
  root.traverse(node => {
    if (!node.name.startsWith('Intersection_')) return;
    const ud = node.userData as { q?: number; r?: number };
    if (typeof ud.q !== 'number' || typeof ud.r !== 'number') return;
    node.getWorldPosition(_origin);
    const top = raycastPlaySurfaceY(root, _origin.x, _origin.z, meshes) ?? BOARD.PLAYFIELD_SURFACE_Y;
    map.set(yinshCoordKey({ x: ud.q, y: ud.r }), top);
  });
  return map;
}

export async function loadYinshArenaTemplate(initialTheme: ThemeId = 'light'): Promise<YinshArenaTemplate> {
  const gltf = await loadGltfAsync(arenaAssetUrl());
  const root = prepareArenaScene(gltf.scene as THREE.Group, initialTheme);
  const meshes = collectArenaMeshes(root);
  alignArenaVertical(root, meshes);
  const surfaceByCoord = buildSurfaceMap(root, meshes);

  const fallbackY = BOARD.PLAYFIELD_SURFACE_Y;

  return {
    root,
    surfaceY(coord) {
      return surfaceByCoord.get(yinshCoordKey(coord)) ?? fallbackY;
    },
    frameBounds() {
      _box.setFromObject(root);
      return _box.clone();
    },
    setTheme(themeId: ThemeId) {
      applyArenaGlbThemeMaterials(root, themeId, YINSH_ARENA_KEEP_GLB_MATERIALS);
    },
  };
}

/** World XZ of an intersection node after arena load (before optional root Y is re-applied on clones). */
export function yinshArenaIntersectionWorldXz(q: number, r: number, root: THREE.Object3D): THREE.Vector2 | null {
  let match: THREE.Object3D | undefined;
  root.traverse(node => {
    if (match || !node.name.startsWith('Intersection_')) return;
    const ud = node.userData as { q?: number; r?: number };
    if (ud.q === q && ud.r === r) match = node;
  });
  if (!match) return null;
  match.getWorldPosition(_origin);
  return new THREE.Vector2(_origin.x, _origin.z);
}

export function yinshArenaPlacementError(coord: YinshCoord, root: THREE.Object3D): number {
  const target = yinshWorldPoint(coord);
  const arena = yinshArenaIntersectionWorldXz(coord.x, coord.y, root);
  if (!arena) return Infinity;
  return Math.hypot(arena.x - target.x, arena.y - target.z);
}

function computeArenaFramePoints(arenaTemplate: THREE.Group): THREE.Vector3[] {
  _box.setFromObject(arenaTemplate);
  if (_box.isEmpty()) return [];
  const pad = 0.35;
  const y = BOARD.PLAYFIELD_SURFACE_Y;
  const points: THREE.Vector3[] = [];
  for (const x of [_box.min.x - pad, _box.max.x + pad]) {
    for (const z of [_box.min.z - pad, _box.max.z + pad]) {
      points.push(new THREE.Vector3(x, y, z));
    }
  }
  return points;
}

export function createYinshArenaTopology(arenaTemplate: THREE.Group): Topology {
  const base = createYinshTopology();
  const framePoints = computeArenaFramePoints(arenaTemplate);

  return {
    ...base,
    buildBoard(ctx) {
      ctx.board.add(arenaTemplate.clone(true));
      return true;
    },
    frameCorners(snapshot: BoardSnapshot) {
      const points = base.frameCorners?.(snapshot) ?? [];
      return points.concat(framePoints.map(p => p.clone()));
    },
  };
}
