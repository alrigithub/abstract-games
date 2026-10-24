import {
  BOARD,
  createSquareTopology,
  loadGltfAsync,
  mapUrl,
  tagArenaGlbForShadows,
  tagBoardGridLine,
  tagExcludeFromBounds,
  type BoardBuildContext,
  type SquareGridOptions,
  type Topology,
} from '@abstract/three-engine';
import * as THREE from 'three';
import { PropertyBinding } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Documented SHA-256 of the committed arena in `web-3d/lib/maps/boop-map.glb`. */
export const BOOP_ARENA_GLB_SHA256 =
  'd16c644fdd0851eb9b5f95401d660d060907d040257080fbd12ab234b2ff4f60';
export const BOOP_ARENA_GLB_FILE = 'boop-map.glb';

/**
 * Fine-tunes the authored GLB so 6×6 cell centres line up with {@link createSquareTopology}.
 * Derived from Arena Stone node transform + (col, row) ↔ local (col, row − 5) correspondences.
 */
export const BOOP_ARENA_WORLD_CORRECTION = {
  x: 0.145,
  y: -0.12949180603027344,
  z: -0.105,
} as const;

const INFINITE_LIGHT_GROUND_RAW = 'Infinite light ground';
const INFINITE_LIGHT_GROUND_SANITIZED = PropertyBinding.sanitizeNodeName(INFINITE_LIGHT_GROUND_RAW);

const GREENERY_NAME = /moss|groundcover|leaf|leaves|ivy|grass|plant|fern|vine|water/i;

const PLAIN_WHITE = new THREE.Color(0xffffff);

function isInfiniteLightGroundNode(obj: THREE.Object3D): boolean {
  return (
    obj.name === INFINITE_LIGHT_GROUND_RAW ||
    obj.name === INFINITE_LIGHT_GROUND_SANITIZED ||
    obj.name === 'Infinite_light_ground001'
  );
}

function isGreeneryByName(name: string): boolean {
  return GREENERY_NAME.test(name);
}

function materialLooksGreen(mat: THREE.Material): boolean {
  if (isGreeneryByName(mat.name)) return true;
  const color =
    'color' in mat && mat.color instanceof THREE.Color ? (mat.color as THREE.Color) : null;
  if (!color) return false;
  return color.g > color.r + 0.04 && color.g > color.b + 0.03 && color.g > 0.08;
}

function isGreeneryMaterial(mat: THREE.Material): boolean {
  return materialLooksGreen(mat);
}

let sharedArenaMaterial: THREE.MeshStandardMaterial | undefined;

/** One matte white material for the baked arena (avoids hundreds of cloned GLB materials). */
function arenaPlayfieldMaterial(): THREE.MeshStandardMaterial {
  if (!sharedArenaMaterial) {
    sharedArenaMaterial = new THREE.MeshStandardMaterial({
      color: PLAIN_WHITE,
      emissive: new THREE.Color(0x000000),
      metalness: 0,
      roughness: 0.82,
      side: THREE.DoubleSide,
    });
  }
  return sharedArenaMaterial;
}

function disposeMeshMaterials(mesh: THREE.Mesh): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) mat.dispose();
}

const _arenaRootInv = new THREE.Matrix4();
const _arenaBake = new THREE.Matrix4();

/** Alex's export ships ~270 tiny meshes; one draw call keeps piece shadows smooth. */
function consolidateArenaMeshes(scene: THREE.Group): void {
  scene.updateMatrixWorld(true);
  _arenaRootInv.copy(scene.matrixWorld).invert();

  const parts: THREE.BufferGeometry[] = [];
  const toRemove: THREE.Mesh[] = [];

  scene.traverse(node => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    toRemove.push(mesh);
    const geometry = mesh.geometry.clone();
    _arenaBake.multiplyMatrices(_arenaRootInv, mesh.matrixWorld);
    geometry.applyMatrix4(_arenaBake);
    parts.push(geometry);
    disposeMeshMaterials(mesh);
  });

  for (const mesh of toRemove) mesh.parent?.remove(mesh);
  if (!parts.length) return;

  const merged = mergeGeometries(parts, false);
  for (const geometry of parts) geometry.dispose();
  if (!merged) return;

  merged.computeVertexNormals();
  const mesh = new THREE.Mesh(merged, arenaPlayfieldMaterial());
  mesh.name = 'boop-arena-consolidated';
  scene.add(mesh);
}

function arenaAssetUrl(): string {
  return mapUrl(BOOP_ARENA_GLB_FILE);
}

function prepareArenaScene(scene: THREE.Group): THREE.Group {
  scene.name = 'boop-overgrown-arena';
  tagExcludeFromBounds(scene);
  const remove: THREE.Object3D[] = [];
  scene.traverse(obj => {
    if (isInfiniteLightGroundNode(obj) || isGreeneryByName(obj.name)) remove.push(obj);
  });
  for (const obj of remove) obj.parent?.remove(obj);

  scene.position.set(
    BOOP_ARENA_WORLD_CORRECTION.x,
    BOOP_ARENA_WORLD_CORRECTION.y,
    BOOP_ARENA_WORLD_CORRECTION.z,
  );

  const removeMeshes: THREE.Object3D[] = [];
  scene.traverse(node => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some(isGreeneryMaterial)) {
      removeMeshes.push(mesh);
      return;
    }
  });
  for (const obj of removeMeshes) obj.parent?.remove(obj);
  consolidateArenaMeshes(scene);
  tagArenaGlbForShadows(scene);

  return scene;
}

export async function loadBoopArenaTemplate(): Promise<THREE.Group> {
  const gltf = await loadGltfAsync(arenaAssetUrl());
  return prepareArenaScene(gltf.scene as THREE.Group);
}

/** Same grid lines as the engine default square bed (Alex: keep the line). */
export function addBoopPlayGridLines(ctx: BoardBuildContext): void {
  const { board, gridMaterial, boardGeometries, gridSize: size } = ctx;
  const half = size / 2;
  const lineWidth = BOARD.LINE_W;
  for (let i = 0; i <= size; i++) {
    const offset = i - half;
    for (const axis of ['x', 'z'] as const) {
      const geo = new THREE.PlaneGeometry(
        axis === 'x' ? lineWidth : size + lineWidth,
        axis === 'z' ? lineWidth : size + lineWidth,
      );
      boardGeometries.push(geo);
      const line = new THREE.Mesh(geo, gridMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(axis === 'x' ? offset : 0, BOARD.LINE_Y, axis === 'z' ? offset : 0);
      tagBoardGridLine(line, { thicknessAxis: axis === 'x' ? 'x' : 'z' });
      board.add(line);
    }
  }
}

/** Compact ground under the 6×6 bed + exterior pools (matches white arena). */
export function boopPlayfieldGroundSize(gridSize: number, outsideRows: number): number {
  const half = gridSize / 2 + outsideRows + 0.85;
  return Math.ceil(half * 2 + 1.5);
}

export function createBoopTopology(options: SquareGridOptions, arenaTemplate: THREE.Group): Topology {
  const base = createSquareTopology(options);

  return {
    ...base,
    buildBoard(ctx) {
      ctx.board.add(arenaTemplate.clone(true));
      addBoopPlayGridLines(ctx);
      return true;
    },
  };
}
