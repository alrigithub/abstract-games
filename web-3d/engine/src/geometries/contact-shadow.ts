import * as THREE from 'three';
import { BOARD } from '../constants';

/** Baked elliptical contact blob under the board (no shadow maps). */
export function createContactShadowBlob(scale: number, slabThickness: number = BOARD.SLAB): THREE.Mesh {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(0.35, 'rgba(0,0,0,0.18)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: BOARD.CONTACT_BLOB_OPACITY,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y =
    slabThickness > 1e-6 ? -slabThickness / 2 - 0.002 : -BOARD.LINE_Y * 0.5;
  mesh.scale.setScalar(scale * BOARD.CONTACT_BLOB_SOFT_SCALE);
  mesh.renderOrder = 0;
  return mesh;
}
