import * as THREE from 'three';
import { BOARD } from './constants';
import { tagExcludeFromBounds } from './playfield-bounds';

export const PLAYFIELD_GROUND_USER_DATA = 'playfieldGround' as const;

/** Single shared ground extent — larger than any camera pan/zoom in {@link CAMERA} limits. */
export function createPlayfieldGroundGeometry(): THREE.PlaneGeometry {
  const size = BOARD.PLAYFIELD_GROUND_SIZE;
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  return geo;
}

export function createPlayfieldGroundMesh(material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(createPlayfieldGroundGeometry(), material);
  mesh.userData[PLAYFIELD_GROUND_USER_DATA] = true;
  tagExcludeFromBounds(mesh);
  mesh.position.y = BOARD.PLAYFIELD_SURFACE_Y;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.renderOrder = -1;
  return mesh;
}

/** Match scene background and fog to the playfield so the horizon blends seamlessly. */
export function applyPlayfieldBackdrop(scene: THREE.Scene, tableColor: THREE.Color | string): void {
  const color = tableColor instanceof THREE.Color ? tableColor : new THREE.Color(tableColor);
  scene.background = color.clone();
  scene.fog = new THREE.Fog(color.getHex(), BOARD.PLAYFIELD_FOG_NEAR, BOARD.PLAYFIELD_FOG_FAR);
}
