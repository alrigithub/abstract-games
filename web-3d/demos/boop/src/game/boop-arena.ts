import {
  BOARD,
  createSquareTopology,
  tagBoardGridLine,
  tagExcludeFromBounds,
  type BoardBuildContext,
  type BoardSnapshot,
  type Topology,
} from '@abstract/three-engine';
import type { SquareGridOptions } from '@abstract/three-engine';
import * as THREE from 'three';
import { PropertyBinding } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Verified SHA-256 of Alex's arena GLB (see `public/assets/overgrown-arena-two-depressions2-white.glb`). */
export const BOOP_ARENA_GLB_SHA256 =
  '9121e2a1946ae4e780b23ef357362177eb49f12ced6a66e48afafe10e3169093';
export const BOOP_ARENA_GLB_FILE = 'overgrown-arena-two-depressions2-white.glb';

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

function toPlainWhiteMaterial(source: THREE.Material): THREE.Material {
  const mat = source.clone();
  if (mat instanceof THREE.MeshStandardMaterial) {
    mat.map = null;
    mat.normalMap = null;
    mat.roughnessMap = null;
    mat.metalnessMap = null;
    mat.aoMap = null;
    mat.emissiveMap = null;
    mat.alphaMap = null;
    mat.color.copy(PLAIN_WHITE);
    mat.emissive.setHex(0x000000);
    mat.metalness = 0;
    mat.roughness = 0.82;
    mat.transparent = false;
    mat.opacity = 1;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.transmission = 0;
      mat.thickness = 0;
      mat.ior = 1.5;
    }
  }
  return mat;
}

function whitenMeshMaterials(mesh: THREE.Mesh): void {
  const apply = (mat: THREE.Material) => toPlainWhiteMaterial(mat);
  if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(apply);
  else mesh.material = apply(mesh.material);
}

function arenaAssetUrl(): string {
  return new URL(`assets/${BOOP_ARENA_GLB_FILE}`, document.baseURI).toString();
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
    whitenMeshMaterials(mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  for (const obj of removeMeshes) obj.parent?.remove(obj);

  return scene;
}

export async function loadBoopArenaTemplate(): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
    loader.load(arenaAssetUrl(), resolve, undefined, reject);
  });
  return prepareArenaScene(gltf.scene);
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

const _frameBox = new THREE.Box3();

export function createBoopTopology(options: SquareGridOptions, arenaTemplate: THREE.Group): Topology {
  const base = createSquareTopology(options);
  const framePoints = computeArenaFramePoints(arenaTemplate);

  return {
    ...base,
    buildBoard(ctx) {
      ctx.board.add(arenaTemplate.clone(true));
      addBoopPlayGridLines(ctx);
      return true;
    },
    frameCorners(snapshot: BoardSnapshot) {
      const points = base.frameCorners?.(snapshot) ?? [];
      return points.concat(framePoints.map(p => p.clone()));
    },
  };
}

function computeArenaFramePoints(arenaTemplate: THREE.Group): THREE.Vector3[] {
  _frameBox.setFromObject(arenaTemplate);
  if (_frameBox.isEmpty()) return [];
  const pad = 0.48;
  const y = 0;
  const points: THREE.Vector3[] = [];
  for (const x of [_frameBox.min.x - pad, _frameBox.max.x + pad]) {
    for (const z of [_frameBox.min.z - pad, _frameBox.max.z + pad]) {
      points.push(new THREE.Vector3(x, y, z));
    }
  }
  return points;
}
