import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  YINSH,
  createYinshMarkerGeometry,
  createYinshRingGeometry,
  yinshPieceGeometrySet,
  type EnginePiece,
  applyClayPieceMaterials,
  applyGhostOpacity,
  clonePieceVisualTemplate,
  pieceGlbSideForPlayer,
  type AssistGhostHint,
  type PieceGeometrySet,
  type ThemeId,
} from '@abstract/three-engine';

/** World-space ring outer diameter (hex spacing = 1; slight gap to neighbours). */
export const YINSH_RING_TARGET_OUTER_DIAMETER = 0.96;

/** @deprecated Use {@link YINSH_RING_TARGET_OUTER_DIAMETER} / 2 for footprint. */
export const YINSH_RING_TARGET_RADIUS = YINSH_RING_TARGET_OUTER_DIAMETER / 2;

/** Alex GLB ring outer diameter in meters (README). */
export const YINSH_RING_OUTER_DIAMETER_M = 0.032;

/** Single uniform scale for every Yinsh stone GLB (meters → world units). */
export const YINSH_GLB_WORLD_SCALE = YINSH_RING_TARGET_OUTER_DIAMETER / YINSH_RING_OUTER_DIAMETER_M;

/** Authored marker diameter in meters (README). */
export const YINSH_MARKER_OUTER_DIAMETER_M = 0.0206;

/** World-space marker radius after {@link YINSH_GLB_WORLD_SCALE}. */
export const YINSH_MARKER_WORLD_RADIUS = (YINSH_MARKER_OUTER_DIAMETER_M / 2) * YINSH_GLB_WORLD_SCALE;

/** Move-assist destination dots (~35% of marker diameter). */
export const YINSH_ASSIST_DOT_RADIUS = YINSH_MARKER_WORLD_RADIUS * 0.35;

/** Flat marker preview sits slightly above the playfield, visible through ring holes. */
export const YINSH_MARKER_GHOST_SURFACE_Y = 0.016;

/** World-space ring footprint for assist shadows / ghosts (matches GLB scale). */
export const YINSH_RING_OUTER_RADIUS = YINSH_RING_TARGET_OUTER_DIAMETER / 2;

/** Hollow centre — slightly larger than a seated marker. */
export const YINSH_RING_INNER_RADIUS = YINSH_MARKER_WORLD_RADIUS + 0.012;

export const YINSH_RING_FOOTPRINT = {
  shape: 'ring' as const,
  outerRadius: YINSH_RING_OUTER_RADIUS,
  innerRadius: YINSH_RING_INNER_RADIUS,
};

export const YINSH_MARKER_FOOTPRINT = {
  shape: 'disc' as const,
  outerRadius: YINSH_MARKER_WORLD_RADIUS * 0.92,
};

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
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const origin = typeof document !== 'undefined' && document.baseURI ? document.baseURI : 'http://127.0.0.1/';
  return new URL(`${prefix}${path}`, origin).href;
}

function configureStoneRenderOrder(object: THREE.Object3D, shape: ShapeKey): void {
  object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.renderOrder = shape === 'marker' ? 2 : 1;
  });
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

function prepareTemplate(scene: THREE.Object3D, shape: ShapeKey): THREE.Object3D {
  const root = clonePieceVisualTemplate(scene);
  root.scale.setScalar(YINSH_GLB_WORLD_SCALE);
  root.updateMatrixWorld(true);
  anchorObjectBaseToY0(root);
  configureStoneRenderOrder(root, shape);
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
  applyClayPieceMaterials(ringWhite, 'light');
  applyClayPieceMaterials(ringBlack, 'dark');
  applyClayPieceMaterials(markerWhite, 'light');
  applyClayPieceMaterials(markerBlack, 'dark');
  const ring = { A: prepareTemplate(ringWhite, 'ring'), B: prepareTemplate(ringBlack, 'ring') };
  const marker = { A: prepareTemplate(markerWhite, 'marker'), B: prepareTemplate(markerBlack, 'marker') };
  return {
    ring,
    marker,
    heights: {
      ring: measureHeight(ring.A),
      marker: measureHeight(marker.A),
    },
  };
}

let yinshPieceTheme: ThemeId = 'light';

function templateFor(templates: YinshTemplates, piece: EnginePiece): THREE.Object3D {
  const shape = piece.shape === 'marker' ? 'marker' : 'ring';
  const side = pieceGlbSideForPlayer(yinshPieceTheme, piece.player);
  return templates[shape][side];
}

function mountModel(root: THREE.Group, model: THREE.Object3D) {
  root.clear();
  root.add(model);
}

function buildAssistGhostVisual(
  templates: YinshTemplates,
  hint: AssistGhostHint,
): THREE.Object3D | null {
  const shape = hint.pieceShape;
  if (!shape) return null;
  const piece: EnginePiece = { id: 'assist-ghost', player: hint.player, shape };
  const model = clonePieceVisualTemplate(templateFor(templates, piece));
  configureStoneRenderOrder(model, shape === 'marker' ? 'marker' : 'ring');
  applyGhostOpacity(model, 0.5);
  const root = new THREE.Group();
  mountModel(root, model);
  return root;
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
        const shape = piece.shape === 'marker' ? 'marker' : 'ring';
        const model = clonePieceVisualTemplate(templateFor(templates, piece));
        configureStoneRenderOrder(model, shape);
        mountModel(root, model);
        return root;
      },
      replaceVisual(root, piece) {
        const shape = piece.shape === 'marker' ? 'marker' : 'ring';
        const model = clonePieceVisualTemplate(templateFor(templates, piece));
        configureStoneRenderOrder(model, shape);
        mountModel(root as THREE.Group, model);
      },
      onThemeChange(id) {
        yinshPieceTheme = id;
      },
      createAssistGhost(hint, _themeId) {
        return buildAssistGhostVisual(templates, hint);
      },
    };
  } catch (error) {
    console.warn('Yinsh GLB pieces failed to load; using procedural fallback.', error);
    return fallback;
  }
}
