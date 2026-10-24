import * as THREE from 'three';
import { BOARD } from './constants';
import { WIN_ACCENT } from './theme';
import type { BoardAssistState, ThemeTokens } from './types';

const DOT_Y = BOARD.LINE_Y + 0.004;
const RING_Y = BOARD.LINE_Y + 0.003;

type CellPosition = (index: number) => THREE.Vector3;

export class BoardAssistLayer {
  private readonly root = new THREE.Group();
  private readonly dotPool: THREE.Mesh[] = [];
  private readonly ringPool: THREE.Mesh[] = [];
  private pathLine: THREE.Line | null = null;
  private lastMoveGroup = new THREE.Group();
  private dotMaterial: THREE.MeshBasicMaterial;
  private pathMaterial: THREE.LineBasicMaterial;
  private ringMaterial: THREE.MeshBasicMaterial;
  private highlightRingMaterial: THREE.MeshBasicMaterial;
  private lastMoveMaterial: THREE.LineBasicMaterial;
  private lastMoveDotMaterial: THREE.MeshBasicMaterial;

  constructor() {
    this.dotMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.pathMaterial = new THREE.LineBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.highlightRingMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.lastMoveMaterial = new THREE.LineBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.lastMoveDotMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.root.add(this.lastMoveGroup);
  }

  attach(parent: THREE.Scene) {
    parent.add(this.root);
  }

  dispose() {
    this.root.removeFromParent();
    for (const m of this.dotPool) m.geometry.dispose();
    for (const m of this.ringPool) m.geometry.dispose();
    this.pathLine?.geometry.dispose();
    this.dotMaterial.dispose();
    this.pathMaterial.dispose();
    this.ringMaterial.dispose();
    this.highlightRingMaterial.dispose();
    this.lastMoveMaterial.dispose();
    this.lastMoveDotMaterial.dispose();
  }

  applyTheme(tokens: ThemeTokens) {
    const accent = tokens.win;
    this.dotMaterial.color.set(accent);
    this.pathMaterial.color.set(accent);
    this.ringMaterial.color.set(accent);
    this.highlightRingMaterial.color.set(accent);
    this.lastMoveMaterial.color.set(accent);
    this.lastMoveDotMaterial.color.set(accent);
  }

  update(state: BoardAssistState | null, cellPosition: CellPosition) {
    this.root.visible = !!state;
    if (!state) {
      this.hideAllDots();
      this.hideAllRings();
      this.setPath(null, cellPosition);
      this.clearLastMove();
      return;
    }

    this.placeDots(state.destinationCells ?? [], cellPosition, 0.045, this.dotMaterial);
    const highlight = new Set(state.highlightCells ?? []);
    if (state.hoverCell !== undefined && state.hoverCell !== null) highlight.add(state.hoverCell);
    const pickable = state.pickableCells ?? [];
    const ringCells: number[] = [];
    if (state.selectedCell !== undefined && state.selectedCell !== null) ringCells.push(state.selectedCell);
    for (const c of pickable) {
      if (c === state.hoverCell) ringCells.push(c);
    }
    for (const c of highlight) ringCells.push(c);
    this.placeRings(ringCells, cellPosition, highlight);

    this.setPath(state.pathCells, cellPosition);
    this.setLastMove(state.lastMove, cellPosition);
  }

  private hideAllDots() {
    for (const m of this.dotPool) m.visible = false;
  }

  private hideAllRings() {
    for (const m of this.ringPool) m.visible = false;
  }

  private placeDots(cells: readonly number[], cellPosition: CellPosition, radius: number, material: THREE.Material) {
    this.hideAllDots();
    const geo =
      this.dotPool[0]?.geometry ??
      new THREE.CircleGeometry(radius, BOARD.RADIAL_SEGMENTS);
    for (let i = 0; i < cells.length; i++) {
      let mesh = this.dotPool[i];
      if (!mesh) {
        mesh = new THREE.Mesh(geo, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 5;
        this.root.add(mesh);
        this.dotPool.push(mesh);
      }
      mesh.visible = true;
      const p = cellPosition(cells[i]!);
      mesh.position.set(p.x, DOT_Y, p.z);
    }
  }

  private placeRings(cells: readonly number[], cellPosition: CellPosition, strong: Set<number>) {
    this.hideAllRings();
    const unique = [...new Set(cells)];
    const outer = 0.11;
    const inner = 0.085;
    for (let i = 0; i < unique.length; i++) {
      const index = unique[i]!;
      let mesh = this.ringPool[i];
      if (!mesh) {
        const geo = new THREE.RingGeometry(inner, outer, BOARD.RADIAL_SEGMENTS);
        mesh = new THREE.Mesh(geo, this.ringMaterial);
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 6;
        this.root.add(mesh);
        this.ringPool.push(mesh);
      }
      mesh.visible = true;
      mesh.material = strong.has(index) ? this.highlightRingMaterial : this.ringMaterial;
      const p = cellPosition(index);
      mesh.position.set(p.x, RING_Y, p.z);
    }
  }

  private setPath(cells: readonly number[] | undefined | null, cellPosition: CellPosition) {
    if (!cells || cells.length < 2) {
      if (this.pathLine) this.pathLine.visible = false;
      return;
    }
    const points = cells.map(i => {
      const p = cellPosition(i);
      return new THREE.Vector3(p.x, DOT_Y + 0.001, p.z);
    });
    if (!this.pathLine) {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      this.pathLine = new THREE.Line(geo, this.pathMaterial);
      this.pathLine.renderOrder = 7;
      this.root.add(this.pathLine);
    } else {
      this.pathLine.geometry.dispose();
      this.pathLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.pathLine.visible = true;
    }
  }

  private clearLastMove() {
    for (const child of [...this.lastMoveGroup.children]) {
      if ((child as THREE.Line).geometry) (child as THREE.Line).geometry.dispose();
      this.lastMoveGroup.remove(child);
    }
  }

  private setLastMove(
    last: BoardAssistState['lastMove'],
    cellPosition: CellPosition,
  ) {
    this.clearLastMove();
    if (!last) return;
    const path = last.pathCells ?? [last.fromCell, last.toCell];
    if (path.length >= 2) {
      const points = path.map(i => {
        const p = cellPosition(i);
        return new THREE.Vector3(p.x, DOT_Y + 0.002, p.z);
      });
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, this.lastMoveMaterial);
      line.renderOrder = 8;
      this.lastMoveGroup.add(line);
    }
    for (const index of [last.fromCell, last.toCell]) {
      const p = cellPosition(index);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.055, BOARD.RADIAL_SEGMENTS), this.lastMoveDotMaterial);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(p.x, DOT_Y + 0.003, p.z);
      dot.renderOrder = 9;
      this.lastMoveGroup.add(dot);
    }
  }
}

const FLIP_EMISSIVE = new THREE.Color(WIN_ACCENT);

export function applyFlipEmphasis(root: THREE.Object3D, active: boolean) {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      if (active) {
        mat.emissive.copy(FLIP_EMISSIVE);
        mat.emissiveIntensity = 0.45;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  });
}
