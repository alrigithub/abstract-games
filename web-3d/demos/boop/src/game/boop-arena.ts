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

function isInfiniteLightGroundNode(obj: THREE.Object3D): boolean {
  return obj.name === INFINITE_LIGHT_GROUND_RAW || obj.name === INFINITE_LIGHT_GROUND_SANITIZED;
}

function arenaAssetUrl(): string {
  return new URL(`assets/${BOOP_ARENA_GLB_FILE}`, document.baseURI).toString();
}

function prepareArenaScene(scene: THREE.Group): THREE.Group {
  scene.name = 'boop-arena-test';
  tagExcludeFromBounds(scene);
  const remove: THREE.Object3D[] = [];
  scene.traverse(obj => {
    if (isInfiniteLightGroundNode(obj)) remove.push(obj);
  });
  for (const obj of remove) obj.parent?.remove(obj);

  scene.position.set(
    BOOP_ARENA_WORLD_CORRECTION.x,
    BOOP_ARENA_WORLD_CORRECTION.y,
    BOOP_ARENA_WORLD_CORRECTION.z,
  );

  scene.traverse(node => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

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
