import * as THREE from 'three';
import { BOARD, GOMOKU_DIMS } from '@abstract/three-engine';

/** Warm celebration tint (matches Yinsh run-glow halos). */
export const GOMOKU_WIN_GLOW_COLOR = '#ffb347';

const HALO_SCALE = 2.2;
const HALO_BASE_OPACITY = 0.84;
const HALO_Y = BOARD.PLAYFIELD_SURFACE_Y + 0.0008;
const HALO_RENDER_ORDER = 0;

export function createWarmCelebrationDiscTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 210, 120, 1)');
  gradient.addColorStop(0.28, 'rgba(255, 179, 71, 0.92)');
  gradient.addColorStop(0.55, 'rgba(255, 150, 40, 0.45)');
  gradient.addColorStop(0.78, 'rgba(255, 120, 20, 0.12)');
  gradient.addColorStop(1, 'rgba(255, 100, 10, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class GomokuWinGlowLayer {
  private readonly root = new THREE.Group();
  private readonly pool: THREE.Mesh[] = [];
  private readonly texture: THREE.CanvasTexture | null;
  private readonly sharedGeometry: THREE.CircleGeometry;
  private pulseActive = false;
  private readonly haloRadius = GOMOKU_DIMS.STONE_R * HALO_SCALE;

  constructor() {
    this.texture = createWarmCelebrationDiscTexture();
    this.sharedGeometry = new THREE.CircleGeometry(1, BOARD.RADIAL_SEGMENTS);
  }

  attach(parent: THREE.Object3D) {
    parent.add(this.root);
  }

  needsContinuousRender(): boolean {
    return this.pulseActive;
  }

  visibleHaloCount(): number {
    let n = 0;
    for (const mesh of this.pool) if (mesh.visible) n++;
    return n;
  }

  setWorldCells(cells: readonly { x: number; z: number }[]) {
    for (const mesh of this.pool) mesh.visible = false;
    this.pulseActive = cells.length > 0;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]!;
      let mesh = this.pool[i];
      if (!mesh) {
        const material = new THREE.MeshBasicMaterial({
          color: GOMOKU_WIN_GLOW_COLOR,
          transparent: true,
          opacity: HALO_BASE_OPACITY,
          depthWrite: false,
          depthTest: true,
          map: this.texture ?? undefined,
        });
        mesh = new THREE.Mesh(this.sharedGeometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = HALO_RENDER_ORDER;
        this.root.add(mesh);
        this.pool.push(mesh);
      }
      mesh.visible = true;
      const mat = mesh.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.color.set(GOMOKU_WIN_GLOW_COLOR);
        mat.opacity = HALO_BASE_OPACITY;
        mat.depthTest = true;
        mat.depthWrite = false;
      }
      mesh.userData.runHaloBaseOpacity = HALO_BASE_OPACITY;
      mesh.scale.set(this.haloRadius, this.haloRadius, 1);
      mesh.position.set(cell.x, HALO_Y, cell.z);
    }
  }

  clear() {
    for (const mesh of this.pool) mesh.visible = false;
    this.pulseActive = false;
  }

  /** Gentle pulse on win halos; returns true while active. */
  tick(now: number): boolean {
    if (!this.pulseActive) return false;
    const pulse = 0.92 + 0.08 * Math.sin(now * 0.0042);
    const scale = 1 + 0.05 * Math.sin(now * 0.0042 + 1.1);
    const r = this.haloRadius;
    for (const mesh of this.pool) {
      if (!mesh.visible) continue;
      mesh.scale.set(r * scale, r * scale, 1);
      const mat = mesh.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        const base = mesh.userData.runHaloBaseOpacity as number | undefined;
        if (base !== undefined) mat.opacity = base * pulse;
      }
    }
    return true;
  }

  dispose() {
    this.root.removeFromParent();
    this.sharedGeometry.dispose();
    if (this.texture) this.texture.dispose();
    for (const mesh of this.pool) {
      const mat = mesh.material;
      if (mat instanceof THREE.Material) mat.dispose();
    }
  }
}
