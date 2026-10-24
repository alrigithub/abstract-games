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

/** Verified SHA-256 of Alex's all-white arena (see repo `public/assets/` copy). */
export const BOOP_ARENA_GLB_SHA256 = '2c9a5316421a85cd7a5d82370f0e9e5cb3a5e94e9ae0a27f5a93f5399baf3690';
export const BOOP_ARENA_GLB_FILE = 'overgrown-arena-all-white.glb';

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

function isInfiniteLightGroundNode(obj: THREE.Object3D): boolean {
  return obj.name === INFINITE_LIGHT_GROUND_RAW || obj.name === INFINITE_LIGHT_GROUND_SANITIZED;
}

function arenaAssetUrl(): string {
  return new URL(`assets/${BOOP_ARENA_GLB_FILE}`, document.baseURI).toString();
}

function prepareArenaScene(scene: THREE.Group): THREE.Group {
  scene.name = 'boop-overgrown-arena';
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
