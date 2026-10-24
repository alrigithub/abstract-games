import * as THREE from 'three';
import { BOARD } from './constants';
import { WIN_ACCENT } from './theme';
import type { BoardAssistState, ThemeTokens } from './types';

const DOT_Y = BOARD.LINE_Y + 0.004;
const RING_Y = BOARD.LINE_Y + 0.003;
const DEFAULT_DEST_DOT_RADIUS = 0.11;
const PATH_HALF_WIDTH = 0.024;
const LAST_MOVE_HALF_WIDTH = 0.028;

type CellPosition = (index: number) => THREE.Vector3;

export class BoardAssistLayer {
  private readonly root = new THREE.Group();
  private readonly dotPool: THREE.Mesh[] = [];
  private readonly ringPool: THREE.Mesh[] = [];
  private pathGroup = new THREE.Group();
  private lastMoveGroup = new THREE.Group();
  private destDotMaterial: THREE.MeshBasicMaterial;
  private pathMaterial: THREE.MeshBasicMaterial;
  private ringMaterial: THREE.MeshBasicMaterial;
  private highlightRingMaterial: THREE.MeshBasicMaterial;
  private lastMoveMaterial: THREE.MeshBasicMaterial;
  private lastMoveDotMaterial: THREE.MeshBasicMaterial;

  constructor() {
    this.destDotMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    this.pathMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.48,
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
    this.lastMoveMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    this.lastMoveDotMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.root.add(this.pathGroup, this.lastMoveGroup);
  }

  attach(parent: THREE.Scene) {
    parent.add(this.root);
  }

  dispose() {
    this.root.removeFromParent();
    for (const m of this.dotPool) m.geometry.dispose();
    for (const m of this.ringPool) m.geometry.dispose();
    this.clearGroup(this.pathGroup);
    this.clearGroup(this.lastMoveGroup);
    this.destDotMaterial.dispose();
    this.pathMaterial.dispose();
    this.ringMaterial.dispose();
    this.highlightRingMaterial.dispose();
    this.lastMoveMaterial.dispose();
    this.lastMoveDotMaterial.dispose();
  }

  applyTheme(tokens: ThemeTokens) {
    const accent = tokens.win;
    const hint = tokens.lines;
    this.destDotMaterial.color.set(hint);
    this.destDotMaterial.opacity = tokens.table === '#f3f1ec' ? 0.58 : 0.65;
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
      this.clearGroup(this.pathGroup);
      this.clearGroup(this.lastMoveGroup);
      return;
    }

    const dotRadius = state.destinationDotRadius ?? DEFAULT_DEST_DOT_RADIUS;
    this.placeDots(state.destinationCells ?? [], cellPosition, dotRadius, this.destDotMaterial);
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

    this.setSoftPath(this.pathGroup, state.pathCells, cellPosition, PATH_HALF_WIDTH, this.pathMaterial, DOT_Y + 0.001);
    this.setLastMove(state.lastMove, cellPosition);
  }

  private hideAllDots() {
    for (const m of this.dotPool) m.visible = false;
  }

  private hideAllRings() {
    for (const m of this.ringPool) m.visible = false;
  }

  private clearGroup(group: THREE.Group) {
    for (const child of [...group.children]) {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
      group.remove(child);
    }
  }

  private placeDots(cells: readonly number[], cellPosition: CellPosition, radius: number, material: THREE.Material) {
    this.hideAllDots();
    for (let i = 0; i < cells.length; i++) {
      let mesh = this.dotPool[i];
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.CircleGeometry(1, BOARD.RADIAL_SEGMENTS), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 5;
        this.root.add(mesh);
        this.dotPool.push(mesh);
      }
      mesh.visible = true;
      mesh.material = material;
      mesh.scale.set(radius, radius, 1);
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

  private worldPointsFromCells(cells: readonly number[], cellPosition: CellPosition, y: number): THREE.Vector3[] {
    return cells.map(i => {
      const p = cellPosition(i);
      return new THREE.Vector3(p.x, y, p.z);
    });
  }

  private setSoftPath(
    group: THREE.Group,
    cells: readonly number[] | undefined | null,
    cellPosition: CellPosition,
    halfWidth: number,
    material: THREE.Material,
    y: number,
    worldOverride?: readonly { x: number; z: number }[],
  ) {
    this.clearGroup(group);
    if (!cells || cells.length < 2) return;
    const points =
      worldOverride && worldOverride.length === cells.length
        ? worldOverride.map(w => new THREE.Vector3(w.x, y, w.z))
        : this.worldPointsFromCells(cells, cellPosition, y);
    this.addSoftPolyline(group, points, halfWidth, material);
  }

  private addSoftPolyline(group: THREE.Group, points: THREE.Vector3[], halfWidth: number, material: THREE.Material) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-5) continue;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.002, halfWidth * 2), material);
      mesh.position.set((a.x + b.x) / 2, a.y, (a.z + b.z) / 2);
      mesh.rotation.y = Math.atan2(dz, dx);
      mesh.renderOrder = 7;
      group.add(mesh);
    }
  }

  private setLastMove(last: BoardAssistState['lastMove'], cellPosition: CellPosition) {
    this.clearGroup(this.lastMoveGroup);
    if (!last) return;
    const pathCells = last.pathCells ?? [last.fromCell, last.toCell];
    const y = DOT_Y + 0.002;
    this.setSoftPath(
      this.lastMoveGroup,
      pathCells,
      cellPosition,
      LAST_MOVE_HALF_WIDTH,
      this.lastMoveMaterial,
      y,
      last.pathWorld,
    );
    const endpoints =
      last.pathWorld && last.pathWorld.length >= 2
        ? [last.pathWorld[0]!, last.pathWorld[last.pathWorld.length - 1]!]
        : [
            { x: cellPosition(last.fromCell).x, z: cellPosition(last.fromCell).z },
            { x: cellPosition(last.toCell).x, z: cellPosition(last.toCell).z },
          ];
    for (const ep of endpoints) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.055, BOARD.RADIAL_SEGMENTS), this.lastMoveDotMaterial);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(ep.x, DOT_Y + 0.003, ep.z);
      dot.renderOrder = 9;
      this.lastMoveGroup.add(dot);
    }
  }
}
