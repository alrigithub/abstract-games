import * as THREE from 'three';
import { BOARD } from './constants';
import { tagExcludeFromBounds } from './playfield-bounds';

export const PLAYFIELD_GROUND_USER_DATA = 'playfieldGround' as const;

/** White floor Boop uses under its arena (light theme and the live GLB path). */
export const ARENA_GLB_SURFACE_COLOR = '#ffffff';

/** Roughness shared by the live arena ground plane and {@link arenaPlayfieldMaterial}. */
export const ARENA_GROUND_ROUGHNESS = 0.82;

/**
 * Square ground that pads a playfield the same way Boop's arena ground does.
 * `playfieldSpan` is the world width of the bed (grid size + exterior rows).
 */
export function arenaPlayfieldGroundSize(playfieldSpan: number): number {
  const half = playfieldSpan / 2 + 0.85;
  return Math.ceil(half * 2 + 1.5);
}

export function createArenaGroundMaterial(surfaceColor: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: surfaceColor,
    roughness: ARENA_GROUND_ROUGHNESS,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

/** Single shared ground extent — larger than any camera pan/zoom in {@link CAMERA} limits. */
export function createPlayfieldGroundGeometry(
  size: number = BOARD.PLAYFIELD_GROUND_SIZE,
): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  return geo;
}

export function createPlayfieldGroundMesh(
  material: THREE.Material,
  size: number = BOARD.PLAYFIELD_GROUND_SIZE,
): THREE.Mesh {
  const mesh = new THREE.Mesh(createPlayfieldGroundGeometry(size), material);
  mesh.userData[PLAYFIELD_GROUND_USER_DATA] = true;
  tagExcludeFromBounds(mesh);
  mesh.position.y = BOARD.PLAYFIELD_SURFACE_Y;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.renderOrder = -1;
  return mesh;
}

/** Match scene background and fog to the playfield / ENV clay so the horizon blends seamlessly. */
export function applyPlayfieldBackdrop(scene: THREE.Scene, tableColor: THREE.Color | string): void {
  const backdrop = new THREE.Color(tableColor);
  scene.background = backdrop;
  scene.fog = new THREE.Fog(backdrop.getHex(), BOARD.PLAYFIELD_FOG_NEAR, BOARD.PLAYFIELD_FOG_FAR);
}
