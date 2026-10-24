import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  GOMOKU_DIMS,
  GOMOKU_GLB_WORLD_SCALE,
  createGomokuStoneGeometry,
  applyGhostOpacity,
  clonePieceVisualTemplate,
  gomokuGlbStoneHeight,
  pieceGlbSideForPlayer,
  tagPieceForShadows,
  themeTokens,
  type ThemeId,
} from '@abstract/three-engine';
type StonePlayer = 'A' | 'B';

const MODEL = {
  white: 'models/go-stone-white.glb',
  black: 'models/go-stone-black.glb',
} as const;

export interface GomokuStoneAssets {
  readonly usesGlb: boolean;
  readonly stoneHeight: number;
  readonly shadowGeometry: THREE.BufferGeometry;
  yawForId(id: string): number;
  createVisual(player: StonePlayer): THREE.Object3D;
  createGhostVisual(player: StonePlayer, themeId: ThemeId): THREE.Object3D;
  replaceVisual(root: THREE.Object3D, player: StonePlayer): void;
  onThemeChange(themeId: ThemeId): void;
  dispose(): void;
}

interface StoneTemplates {
  A: THREE.Object3D;
  B: THREE.Object3D;
}

const _box = new THREE.Box3();

function modelUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const origin = globalThis.location?.href ?? 'http://127.0.0.1/';
  return new URL(`${prefix}${path}`, origin).href;
}

function anchorObjectBaseToY0(object: THREE.Object3D): void {
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  if (Number.isFinite(_box.min.y)) object.position.y -= _box.min.y;
  object.updateMatrixWorld(true);
}

function prepareTemplate(scene: THREE.Object3D): THREE.Object3D {
  const root = clonePieceVisualTemplate(scene);
  root.scale.setScalar(GOMOKU_GLB_WORLD_SCALE);
  root.updateMatrixWorld(true);
  anchorObjectBaseToY0(root);
  return root;
}

async function loadScene(url: string): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

async function buildTemplates(): Promise<StoneTemplates> {
  const [white, black] = await Promise.all([loadScene(modelUrl(MODEL.white)), loadScene(modelUrl(MODEL.black))]);
  return { A: prepareTemplate(white), B: prepareTemplate(black) };
}

let gomokuStoneTheme: ThemeId = 'light';

function templateFor(templates: StoneTemplates, player: StonePlayer): THREE.Object3D {
  const side = pieceGlbSideForPlayer(gomokuStoneTheme, player);
  return side === 'A' ? templates.A : templates.B;
}

function mountModel(root: THREE.Group, model: THREE.Object3D) {
  root.clear();
  root.add(model);
}

export function gomokuStoneYawForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((hash >>> 0) % 1000) / 1000 * (Math.PI / 8);
}

function ghostOpacity(themeId: ThemeId): number {
  return themeTokens(themeId).ghostOpacity;
}

function createProceduralVisual(
  player: StonePlayer,
  geometry: THREE.BufferGeometry,
  materials: { stoneA: THREE.MeshBasicMaterial; stoneB: THREE.MeshBasicMaterial },
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, player === 'A' ? materials.stoneA : materials.stoneB);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  tagPieceForShadows(mesh, false);
  return mesh;
}

/**
 * Load Alex go-stone GLBs; falls back to procedural lens geometry on failure.
 */
export async function loadGomokuStoneAssets(
  materials: { stoneA: THREE.MeshBasicMaterial; stoneB: THREE.MeshBasicMaterial },
): Promise<GomokuStoneAssets> {
  const shadowGeometry = createGomokuStoneGeometry();
  const fallbackHeight = GOMOKU_DIMS.STONE_H;
  try {
    const templates = await buildTemplates();
    const stoneHeight = gomokuGlbStoneHeight();
    const createVisual = (player: StonePlayer) => {
      const root = new THREE.Group();
      mountModel(root, clonePieceVisualTemplate(templateFor(templates, player)));
      tagPieceForShadows(root, false);
      return root;
    };
    return {
      usesGlb: true,
      stoneHeight,
      shadowGeometry,
      yawForId: gomokuStoneYawForId,
      createVisual,
      createGhostVisual(player, themeId) {
        const ghost = createVisual(player);
        applyGhostOpacity(ghost, ghostOpacity(themeId));
        return ghost;
      },
      replaceVisual(root, player) {
        mountModel(root as THREE.Group, clonePieceVisualTemplate(templateFor(templates, player)));
        tagPieceForShadows(root, false);
      },
      onThemeChange(id) {
        gomokuStoneTheme = id;
      },
      dispose() {
        shadowGeometry.dispose();
      },
    };
  } catch (error) {
    console.warn('Gomoku GLB stones failed to load; using procedural fallback.', error);
    return {
      usesGlb: false,
      stoneHeight: fallbackHeight,
      shadowGeometry,
      yawForId: gomokuStoneYawForId,
      createVisual(player) {
        return createProceduralVisual(player, shadowGeometry, materials);
      },
      createGhostVisual(player, themeId) {
        const mesh = createProceduralVisual(player, shadowGeometry, materials);
        const mat = (mesh.material as THREE.MeshBasicMaterial).clone();
        mat.transparent = true;
        mat.opacity = ghostOpacity(themeId);
        mesh.material = mat;
        return mesh;
      },
      replaceVisual() {
        /* procedural stones update materials in the scene */
      },
      onThemeChange() {
        /* procedural path uses theme materials from the scene */
      },
      dispose() {
        shadowGeometry.dispose();
      },
    };
  }
}
