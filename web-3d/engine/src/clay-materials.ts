import * as THREE from 'three';
import { CLAY } from './constants';
import type { ThemeId } from './theme';

export type ClayMaterialRole = 'env' | 'piece_light' | 'piece_dark';

export const CLAY_BLENDER_MATERIAL_NAMES: Record<string, ClayMaterialRole> = {
  clay_env: 'env',
  clay_light: 'piece_light',
  clay_dark: 'piece_dark',
};

const CLAY_USER_DATA = 'clayMaterialRole' as const;

let activeTheme: ThemeId = 'light';

const bank: Record<ClayMaterialRole, THREE.MeshStandardMaterial> = {
  env: createClayMat(CLAY.ENV),
  piece_light: createClayMat(CLAY.PIECE_LIGHT),
  piece_dark: createClayMat(CLAY.PIECE_DARK),
};

function createClayMat(hex: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    roughness: CLAY.MATERIAL_ROUGHNESS,
    metalness: 0,
  });
  mat.name = 'clay_shared';
  return mat;
}

bank.env.side = THREE.DoubleSide;
bank.env.depthWrite = true;

function envHexForTheme(themeId: ThemeId): string {
  return themeId === 'dark' ? CLAY.ENV_DARK : CLAY.ENV;
}

/** Update shared env albedo when the document theme changes (piece clays stay fixed). */
export function syncClayMaterialTheme(themeId: ThemeId): void {
  activeTheme = themeId;
  bank.env.color.set(envHexForTheme(themeId));
}

export function clayMaterialRoleForName(materialName: string | undefined): ClayMaterialRole | null {
  if (!materialName) return null;
  const key = materialName.trim().toLowerCase();
  return CLAY_BLENDER_MATERIAL_NAMES[key] ?? null;
}

export function getClayMaterial(role: ClayMaterialRole): THREE.MeshStandardMaterial {
  return bank[role];
}

export function clayPieceRoleForLogicalPlayer(player: string): ClayMaterialRole {
  return player === 'B' ? 'piece_dark' : 'piece_light';
}

export function clayPieceRoleForAuthoredSide(side: 'light' | 'dark'): ClayMaterialRole {
  return side === 'dark' ? 'piece_dark' : 'piece_light';
}

function resolveMeshClayRole(mesh: THREE.Mesh, options: ApplyClayMaterialsOptions): ClayMaterialRole {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const source of materials) {
    const fromName = clayMaterialRoleForName(source.name);
    if (fromName) return fromName;
  }
  if (options.pieceSide) return clayPieceRoleForAuthoredSide(options.pieceSide);
  return options.defaultRole ?? 'env';
}

function assignClayMaterial(mesh: THREE.Mesh, role: ClayMaterialRole): void {
  mesh.material = getClayMaterial(role);
  mesh.userData[CLAY_USER_DATA] = role;
}

function disposeIncomingMaterial(mesh: THREE.Mesh): void {
  const prev = mesh.material;
  if (Array.isArray(prev)) prev.forEach(m => m.dispose());
  else if (prev instanceof THREE.Material && prev !== bank.env && prev !== bank.piece_light && prev !== bank.piece_dark) {
    prev.dispose();
  }
}

export interface ApplyClayMaterialsOptions {
  /** Default role when Blender names are absent. */
  defaultRole?: ClayMaterialRole;
  /** White/black GLB variant loaded from disk. */
  pieceSide?: 'light' | 'dark';
}

/** Replace every mesh material with a shared clay PBR material (single instance per role). */
export function applyClayMaterials(root: THREE.Object3D, options: ApplyClayMaterialsOptions = {}): void {
  const defaultRole = options.defaultRole ?? (options.pieceSide ? clayPieceRoleForAuthoredSide(options.pieceSide) : 'env');
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const role = resolveMeshClayRole(node, { ...options, defaultRole });
    disposeIncomingMaterial(node);
    assignClayMaterial(node, role);
  });
}

/** Environment GLBs: every mesh gets shared ENV (ignore clay_light/clay_dark names). */
export function applyClayEnvMaterials(root: THREE.Object3D): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    disposeIncomingMaterial(node);
    assignClayMaterial(node, 'env');
  });
}

export function applyClayPieceMaterials(root: THREE.Object3D, side: 'light' | 'dark'): void {
  applyClayMaterials(root, { pieceSide: side });
}

/** Rebind cloned GLB meshes to shared clay materials (after {@link clonePieceVisualTemplate}). */
export function rebindClayMaterialsFromUserData(root: THREE.Object3D): void {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const role = node.userData[CLAY_USER_DATA] as ClayMaterialRole | undefined;
    if (!role) return;
    node.material = getClayMaterial(role);
  });
}

/** Procedural pieces: logical player A/B → shared light/dark clay. */
export function clayMaterialForPlayer(player: string): THREE.MeshStandardMaterial {
  return getClayMaterial(clayPieceRoleForLogicalPlayer(player));
}

export function clayEnvMaterial(): THREE.MeshStandardMaterial {
  return getClayMaterial('env');
}

/** @internal tests */
export function clayMaterialBankSnapshot(): { env: string; pieceLight: string; pieceDark: string; theme: ThemeId } {
  return {
    env: `#${bank.env.color.getHexString()}`,
    pieceLight: `#${bank.piece_light.color.getHexString()}`,
    pieceDark: `#${bank.piece_dark.color.getHexString()}`,
    theme: activeTheme,
  };
}
