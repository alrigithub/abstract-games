import {
  createSquareTopology,
  tagExcludeFromBounds,
  type BoardBuildContext,
  type BoardSnapshot,
  type Topology,
} from '@abstract/three-engine';
import type { SquareGridOptions } from '@abstract/three-engine';
import * as THREE from 'three';
import { PropertyBinding } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Verified SHA-256 of Alex's arena-test GLB (see `public/assets/arena-test.glb`). */
export const BOOP_ARENA_GLB_SHA256 = 'a1f34dc7feb6760fc152022ff48a30487da3631f41c9e83cdfac152eeed57b04';
export const BOOP_ARENA_GLB_FILE = 'arena-test.glb';

/**
 * Fine-tunes the authored GLB so 6×6 cell centres line up with {@link createSquareTopology}.
 * Derived from named Cell A1–F6 node translations in the export.
 */
export const BOOP_ARENA_WORLD_CORRECTION = {
  x: -0.05512980107338198,
  y: 0.07593863517526657,
  z: -0.061370538127037785,
} as const;

const INFINITE_LIGHT_GROUND_RAW = 'Infinite light ground';
const INFINITE_LIGHT_GROUND_SANITIZED = PropertyBinding.sanitizeNodeName(INFINITE_LIGHT_GROUND_RAW);

const GREENERY_NAME = /moss|groundcover|leaf|leaves|ivy|grass|plant|fern|vine|water/i;

const PLAIN_WHITE = new THREE.Color(0xffffff);

function isInfiniteLightGroundNode(obj: THREE.Object3D): boolean {
  return obj.name === INFINITE_LIGHT_GROUND_RAW || obj.name === INFINITE_LIGHT_GROUND_SANITIZED;
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
  scene.name = 'boop-arena-test';
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

/** Boop uses the authored arena mesh for play lines; no engine grid overlay. */
export function addBoopPlayGridLines(_ctx: BoardBuildContext): void {}

export function createBoopTopology(options: SquareGridOptions, arenaTemplate: THREE.Group): Topology {
  const base = createSquareTopology(options);

  return {
    ...base,
    buildBoard(ctx) {
      ctx.board.add(arenaTemplate.clone(true));
      addBoopPlayGridLines(ctx);
      return true;
    },
    frameCorners(snapshot: BoardSnapshot) {
      return base.frameCorners?.(snapshot) ?? [];
    },
  };
}
