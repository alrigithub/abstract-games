import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  YINSH,
  createYinshMarkerGeometry,
  createYinshRingGeometry,
  yinshPieceGeometrySet,
  type EnginePiece,
  type PieceGeometrySet,
} from '@abstract/three-engine';

/** Procedural ring outer radius in world units (matches {@link YINSH.RING_OUTER}). */
export const YINSH_RING_TARGET_RADIUS = YINSH.RING_OUTER;

/** Alex GLB ring outer diameter in meters (README). */
export const YINSH_RING_OUTER_DIAMETER_M = 0.032;

/** Single scale for every Yinsh stone GLB (meters → world units). */
export const YINSH_GLB_WORLD_SCALE = (YINSH_RING_TARGET_RADIUS * 2) / YINSH_RING_OUTER_DIAMETER_M;

const MODEL = {
  ringWhite: 'assets/yinsh-ring-white.glb',
  ringBlack: 'assets/yinsh-ring-black.glb',
  markerWhite: 'assets/yinsh-marker-white.glb',
  markerBlack: 'assets/yinsh-marker-black.glb',
} as const;

type ShapeKey = 'ring' | 'marker';

interface YinshTemplates {
  ring: { A: THREE.Object3D; B: THREE.Object3D };
  marker: { A: THREE.Object3D; B: THREE.Object3D };
  heights: Record<ShapeKey, number>;
}

const _box = new THREE.Box3();

function modelUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? './';
  return new URL(path, base.endsWith('/') ? base : `${base}/`).href;
}

function heightFromBoundingBox(box: THREE.Box3): number {
  return box.max.y - box.min.y;
}

function anchorObjectBaseToY0(object: THREE.Object3D): void {
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  if (Number.isFinite(_box.min.y)) object.position.y -= _box.min.y;
  object.updateMatrixWorld(true);
}

function prepareTemplate(scene: THREE.Object3D): THREE.Object3D {
  const root = scene.clone(true);
  root.scale.setScalar(YINSH_GLB_WORLD_SCALE);
  root.updateMatrixWorld(true);
  anchorObjectBaseToY0(root);
  return root;
}

function measureHeight(template: THREE.Object3D): number {
  _box.setFromObject(template);
  return heightFromBoundingBox(_box);
}

async function loadScene(url: string): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

async function buildTemplates(): Promise<YinshTemplates> {
  const [ringWhite, ringBlack, markerWhite, markerBlack] = await Promise.all([
    loadScene(modelUrl(MODEL.ringWhite)),
    loadScene(modelUrl(MODEL.ringBlack)),
    loadScene(modelUrl(MODEL.markerWhite)),
    loadScene(modelUrl(MODEL.markerBlack)),
  ]);
  const ring = { A: prepareTemplate(ringWhite), B: prepareTemplate(ringBlack) };
  const marker = { A: prepareTemplate(markerWhite), B: prepareTemplate(markerBlack) };
  return {
    ring,
    marker,
    heights: {
      ring: measureHeight(ring.A),
      marker: measureHeight(marker.A),
    },
  };
}

function templateFor(templates: YinshTemplates, piece: EnginePiece): THREE.Object3D {
  const shape = piece.shape === 'marker' ? 'marker' : 'ring';
  const side = piece.player === 'B' ? 'B' : 'A';
  return templates[shape][side];
}

function mountModel(root: THREE.Group, model: THREE.Object3D) {
  root.clear();
  root.add(model);
}

/** Load Alex stone Yinsh GLBs; falls back to procedural geometry on failure. */
export async function loadYinshPieceGeometrySet(): Promise<PieceGeometrySet> {
  const ringGeo = createYinshRingGeometry();
  const markerGeo = createYinshMarkerGeometry();
  const fallback = yinshPieceGeometrySet(ringGeo, markerGeo);
  try {
    const templates = await buildTemplates();
    const ringHeight = templates.heights.ring;
    return {
      geometry(piece) {
        return piece.shape === 'marker' ? markerGeo : ringGeo;
      },
      height(piece) {
        const shape = piece.shape === 'marker' ? 'marker' : 'ring';
        return templates.heights[shape];
      },
      yaw: fallback.yaw,
      edgeThreshold: YINSH.EDGE_THRESHOLD,
      useOutline: () => false,
      materialFor: () => null,
      verticalOffset(piece: EnginePiece, stackIndex: number, stack: EnginePiece[]) {
        if (piece.shape !== 'marker' || stackIndex === 0) return 0;
        const hasRingBelow = stack.slice(0, stackIndex).some(p => p.shape === 'ring');
        if (!hasRingBelow) return 0;
        return -ringHeight;
      },
      createVisual(piece) {
        const root = new THREE.Group();
        mountModel(root, templateFor(templates, piece).clone(true));
        return root;
      },
      replaceVisual(root, piece) {
        mountModel(root as THREE.Group, templateFor(templates, piece).clone(true));
      },
    };
  } catch (error) {
    console.warn('Yinsh GLB pieces failed to load; using procedural fallback.', error);
    return fallback;
  }
}
