import * as THREE from 'three';
import { BOARD } from './constants';
import { WIN_ACCENT } from './theme';
import type {
  AssistFootprint,
  AssistGhostHint,
  AssistRingPickGlow,
  AssistRunRowGlow,
  AssistShadowHint,
  BoardAssistState,
  BoardAssistStats,
  ThemeTokens,
} from './types';

/** Assist draws below piece meshes (renderOrder 1+) but above the board plane. */
const ASSIST_Y = BOARD.LINE_Y + 0.0009;
const PATH_Y = BOARD.LINE_Y + 0.00085;
const SHADOW_Y = BOARD.LINE_Y + 0.001;
const GHOST_Y = BOARD.LINE_Y + 0.0012;
const DOT_Y = BOARD.LINE_Y + 0.0014;
const RING_Y = BOARD.LINE_Y + 0.003;
const DEFAULT_DEST_DOT_RADIUS = 0.11;
const PATH_HALF_WIDTH = 0.024;
const LAST_MOVE_HALF_WIDTH = 0.028;
const RUN_ROW_HALF_WIDTH = 0.032;
const RUN_MARKER_HALO_RADIUS = 0.145;
const ASSIST_RENDER_ORDER = 0;

type CellPosition = (index: number) => THREE.Vector3;

function footprintGeometry(footprint: AssistFootprint): THREE.BufferGeometry {
  if (footprint.shape === 'ring') {
    const inner = footprint.innerRadius ?? footprint.outerRadius * 0.72;
    return new THREE.RingGeometry(inner, footprint.outerRadius, BOARD.RADIAL_SEGMENTS);
  }
  return new THREE.CircleGeometry(footprint.outerRadius, BOARD.RADIAL_SEGMENTS);
}

export class BoardAssistLayer {
  private readonly root = new THREE.Group();
  private readonly dotPool: THREE.Mesh[] = [];
  private readonly ringPool: THREE.Mesh[] = [];
  private readonly shadowPool: THREE.Mesh[] = [];
  private readonly ghostRingPool: THREE.Mesh[] = [];
  private readonly ghostMarkerPool: THREE.Mesh[] = [];
  private readonly runMarkerPool: THREE.Mesh[] = [];
  private readonly ringPickPool: THREE.Mesh[] = [];
  private pathGroup = new THREE.Group();
  private runPathGroup = new THREE.Group();
  private lastMoveGroup = new THREE.Group();
  private destDotMaterial: THREE.MeshBasicMaterial;
  private pathMaterial: THREE.MeshBasicMaterial;
  private ringMaterial: THREE.MeshBasicMaterial;
  private highlightRingMaterial: THREE.MeshBasicMaterial;
  private lastMoveMaterial: THREE.MeshBasicMaterial;
  private lastMoveDotMaterial: THREE.MeshBasicMaterial;
  private markerGhostMaterial: THREE.MeshBasicMaterial;
  private shadowMaterial: THREE.MeshBasicMaterial;
  private ghostRingMaterial: THREE.MeshBasicMaterial;
  private ghostMarkerMaterial: THREE.MeshBasicMaterial;
  private runMarkerMaterial: THREE.MeshBasicMaterial;
  private runPathMaterial: THREE.MeshBasicMaterial;
  private ringPickMaterial: THREE.MeshBasicMaterial;
  private markerGhostMesh: THREE.Mesh | null = null;
  private pieceColors: ThemeTokens['piece'] | null = null;
  private lastStats: BoardAssistStats = { visibleMeshCount: 0, pathSegmentCount: 0 };

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
    this.markerGhostMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    this.ghostRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ghostMarkerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.runMarkerMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.runPathMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    this.ringPickMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.root.add(this.pathGroup, this.runPathGroup, this.lastMoveGroup);
    this.root.renderOrder = ASSIST_RENDER_ORDER;
  }

  attach(parent: THREE.Scene) {
    parent.add(this.root);
  }

  getStats(): BoardAssistStats {
    return this.lastStats;
  }

  dispose() {
    this.root.removeFromParent();
    for (const m of this.dotPool) m.geometry.dispose();
    for (const m of this.ringPool) m.geometry.dispose();
    for (const m of this.shadowPool) m.geometry.dispose();
    for (const m of this.ghostRingPool) m.geometry.dispose();
    for (const m of this.ghostMarkerPool) m.geometry.dispose();
    for (const m of this.runMarkerPool) m.geometry.dispose();
    for (const m of this.ringPickPool) m.geometry.dispose();
    this.clearGroup(this.pathGroup);
    this.clearGroup(this.runPathGroup);
    this.clearGroup(this.lastMoveGroup);
    this.destDotMaterial.dispose();
    this.pathMaterial.dispose();
    this.ringMaterial.dispose();
    this.highlightRingMaterial.dispose();
    this.lastMoveMaterial.dispose();
    this.lastMoveDotMaterial.dispose();
    this.markerGhostMaterial.dispose();
    this.shadowMaterial.dispose();
    this.ghostRingMaterial.dispose();
    this.ghostMarkerMaterial.dispose();
    this.runMarkerMaterial.dispose();
    this.runPathMaterial.dispose();
    this.ringPickMaterial.dispose();
    if (this.markerGhostMesh) this.markerGhostMesh.geometry.dispose();
  }

  applyTheme(tokens: ThemeTokens) {
    this.pieceColors = tokens.piece;
    this.markerGhostMaterial.opacity = tokens.ghostOpacity * 0.85;
    this.ghostMarkerMaterial.opacity = tokens.ghostOpacity * 0.9;
    this.ghostRingMaterial.opacity = tokens.ghostOpacity * 0.72;
    const accent = tokens.win;
    const hint = tokens.lines;
    this.destDotMaterial.color.set(hint);
    this.destDotMaterial.opacity = tokens.table === '#f3f1ec' ? 0.38 : 0.45;
    this.pathMaterial.color.set(accent);
    this.ringMaterial.color.set(accent);
    this.highlightRingMaterial.color.set(accent);
    this.lastMoveMaterial.color.set(accent);
    this.lastMoveDotMaterial.color.set(accent);
    this.runMarkerMaterial.color.set(accent);
    this.runPathMaterial.color.set(accent);
    this.ringPickMaterial.color.set(accent);
    this.shadowMaterial.opacity = tokens.table === '#f3f1ec' ? 0.52 : 0.62;
  }

  update(state: BoardAssistState | null, cellPosition: CellPosition) {
    this.clearGroup(this.pathGroup);
    this.clearGroup(this.runPathGroup);
    this.clearGroup(this.lastMoveGroup);

    if (!state) {
      this.hideAllDots();
      this.hideAllRings();
      this.hideAllShadows();
      this.hideAllGhosts();
      this.hideAllRunMarkers();
      this.hideAllRingPicks();
      this.hideMarkerGhost();
      this.root.visible = false;
      this.lastStats = { visibleMeshCount: 0, pathSegmentCount: 0 };
      return;
    }

    this.root.visible = true;

    const dotRadius = state.destinationDotRadius ?? DEFAULT_DEST_DOT_RADIUS;
    this.placeDots(state.destinationCells ?? [], cellPosition, dotRadius, this.destDotMaterial);

    const highlight = new Set(state.highlightCells ?? []);
    const pickable = state.pickableCells ?? [];
    const ringCells: number[] = [];
    if (state.selectedCell !== undefined && state.selectedCell !== null) ringCells.push(state.selectedCell);
    for (const c of pickable) {
      if (c === state.hoverCell) ringCells.push(c);
    }
    for (const c of highlight) ringCells.push(c);
    this.placeRings(ringCells, cellPosition, highlight);

    const pathSegments = this.setSoftPath(
      this.pathGroup,
      state.pathCells,
      cellPosition,
      PATH_HALF_WIDTH,
      this.pathMaterial,
      PATH_Y,
      state.pathFromWorld,
      state.pathToWorld,
    );

    const lastPathSegments = this.setLastMove(state.lastMove, cellPosition);

    this.placeShadows(state.shadows ?? [], cellPosition);
    this.placeGhosts(state.ghosts ?? [], cellPosition);
    this.placeMarkerGhost(state.markerGhost, cellPosition);
    this.placeRunGlows(state.runGlows ?? [], cellPosition);
    this.placeRingPickGlows(state.ringPickGlows ?? [], cellPosition);

    this.lastStats = {
      visibleMeshCount: this.countVisibleMeshes(),
      pathSegmentCount: pathSegments + lastPathSegments,
    };
  }

  private countVisibleMeshes(): number {
    let n = 0;
    const count = (meshes: THREE.Mesh[]) => {
      for (const m of meshes) if (m.visible) n++;
    };
    count(this.dotPool);
    count(this.ringPool);
    count(this.shadowPool);
    count(this.ghostRingPool);
    count(this.ghostMarkerPool);
    count(this.runMarkerPool);
    count(this.ringPickPool);
    if (this.markerGhostMesh?.visible) n++;
    for (const g of [this.pathGroup, this.runPathGroup, this.lastMoveGroup]) {
      for (const child of g.children) if (child.visible) n++;
    }
    return n;
  }

  private hideMarkerGhost() {
    if (this.markerGhostMesh) this.markerGhostMesh.visible = false;
  }

  private placeMarkerGhost(
    ghost: BoardAssistState['markerGhost'],
    cellPosition: CellPosition,
  ) {
    if (!ghost) {
      this.hideMarkerGhost();
      return;
    }
    if (!this.markerGhostMesh) {
      this.markerGhostMesh = new THREE.Mesh(
        new THREE.CircleGeometry(1, BOARD.RADIAL_SEGMENTS),
        this.markerGhostMaterial,
      );
      this.markerGhostMesh.rotation.x = -Math.PI / 2;
      this.markerGhostMesh.renderOrder = ASSIST_RENDER_ORDER;
      this.root.add(this.markerGhostMesh);
    }
    const fill = this.pieceColors?.[ghost.player]?.fill ?? '#cccccc';
    this.markerGhostMaterial.color.set(fill);
    this.markerGhostMesh.visible = true;
    this.markerGhostMesh.scale.set(ghost.radius, ghost.radius, 1);
    const p = cellPosition(ghost.cell);
    this.markerGhostMesh.position.set(p.x, GHOST_Y, p.z);
  }

  private hideAllDots() {
    for (const m of this.dotPool) m.visible = false;
  }

  private hideAllRings() {
    for (const m of this.ringPool) m.visible = false;
  }

  private hideAllShadows() {
    for (const m of this.shadowPool) {
      m.visible = false;
      if (m.material !== this.shadowMaterial && m.material instanceof THREE.Material) {
        m.material.dispose();
        m.material = this.shadowMaterial;
      }
    }
  }

  private hideAllGhosts() {
    for (const m of this.ghostRingPool) m.visible = false;
    for (const m of this.ghostMarkerPool) m.visible = false;
  }

  private hideAllRunMarkers() {
    for (const m of this.runMarkerPool) m.visible = false;
  }

  private hideAllRingPicks() {
    for (const m of this.ringPickPool) m.visible = false;
  }

  private runMarkerOpacity(strength: AssistRunRowGlow['strength']): number {
    switch (strength) {
      case 'hover':
        return 0.82;
      case 'option':
        return 0.48;
      default:
        return 0.64;
    }
  }

  private placeRunGlows(rows: readonly AssistRunRowGlow[], cellPosition: CellPosition) {
    this.hideAllRunMarkers();
    const markerStrength = new Map<number, AssistRunRowGlow['strength']>();
    const rank = (s: AssistRunRowGlow['strength']) => (s === 'hover' ? 2 : s === 'option' ? 1 : 0);

    for (const row of rows) {
      if (row.lineCells.length >= 2) {
        this.setSoftPath(
          this.runPathGroup,
          row.lineCells,
          cellPosition,
          RUN_ROW_HALF_WIDTH,
          this.runPathMaterial,
          PATH_Y + 0.00015,
        );
      }
      for (const cell of row.markerCells) {
        const prev = markerStrength.get(cell);
        if (!prev || rank(row.strength) > rank(prev)) markerStrength.set(cell, row.strength);
      }
    }

    let i = 0;
    for (const [cell, strength] of markerStrength) {
      let mesh = this.runMarkerPool[i];
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CircleGeometry(RUN_MARKER_HALO_RADIUS, BOARD.RADIAL_SEGMENTS),
          this.runMarkerMaterial,
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = ASSIST_RENDER_ORDER;
        this.root.add(mesh);
        this.runMarkerPool.push(mesh);
      }
      mesh.visible = true;
      const mat = this.runMarkerMaterial.clone();
      mat.opacity = this.runMarkerOpacity(strength);
      mesh.material = mat;
      const p = cellPosition(cell);
      mesh.position.set(p.x, SHADOW_Y + 0.0003, p.z);
      i++;
    }
  }

  private placeRingPickGlows(glows: readonly AssistRingPickGlow[], cellPosition: CellPosition) {
    this.hideAllRingPicks();
    const inner = 0.085;
    const outer = 0.11;
    for (let i = 0; i < glows.length; i++) {
      const glow = glows[i]!;
      let mesh = this.ringPickPool[i];
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.RingGeometry(inner, outer, BOARD.RADIAL_SEGMENTS),
          this.ringPickMaterial,
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = ASSIST_RENDER_ORDER;
        this.root.add(mesh);
        this.ringPickPool.push(mesh);
      }
      mesh.visible = true;
      const mat = this.ringPickMaterial.clone();
      mat.opacity = glow.strength === 'hover' ? 0.72 : 0.46;
      mesh.material = mat;
      const p = cellPosition(glow.cell);
      mesh.position.set(p.x, RING_Y, p.z);
    }
  }

  private clearGroup(group: THREE.Group) {
    for (const child of [...group.children]) {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
      group.remove(child);
    }
  }

  private placeShadows(shadows: readonly AssistShadowHint[], cellPosition: CellPosition) {
    this.hideAllShadows();
    for (let i = 0; i < shadows.length; i++) {
      const hint = shadows[i]!;
      let mesh = this.shadowPool[i];
      const geo = footprintGeometry(hint.footprint);
      if (!mesh) {
        mesh = new THREE.Mesh(geo, this.shadowMaterial);
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = ASSIST_RENDER_ORDER;
        this.root.add(mesh);
        this.shadowPool.push(mesh);
      } else {
        mesh.geometry.dispose();
        mesh.geometry = geo;
      }
      mesh.visible = true;
      const mat = this.shadowMaterial.clone();
      mat.opacity =
        hint.strength === 'hover' ? 0.64 : hint.strength === 'legal' ? 0.3 : 0.48;
      mesh.material = mat;
      const p = cellPosition(hint.cell);
      mesh.position.set(p.x, SHADOW_Y, p.z);
    }
  }

  private placeGhosts(ghosts: readonly AssistGhostHint[], cellPosition: CellPosition) {
    this.hideAllGhosts();
    let ringIdx = 0;
    let markerIdx = 0;
    for (const hint of ghosts) {
      const p = cellPosition(hint.cell);
      const strong = hint.strength === 'strong';
      if (hint.ring) {
        let mesh = this.ghostRingPool[ringIdx];
        const geo = footprintGeometry(hint.ring);
        if (!mesh) {
          mesh = new THREE.Mesh(geo, this.ghostRingMaterial);
          mesh.rotation.x = -Math.PI / 2;
          mesh.renderOrder = ASSIST_RENDER_ORDER;
          this.root.add(mesh);
          this.ghostRingPool.push(mesh);
        } else {
          mesh.geometry.dispose();
          mesh.geometry = geo;
        }
        mesh.visible = true;
        const fill = this.pieceColors?.[hint.player]?.fill ?? '#cccccc';
        this.ghostRingMaterial.color.set(fill);
        this.ghostRingMaterial.opacity = strong ? 0.42 : 0.26;
        mesh.position.set(p.x, GHOST_Y, p.z);
        ringIdx++;
      }
      if (hint.marker) {
        let mesh = this.ghostMarkerPool[markerIdx];
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.CircleGeometry(1, BOARD.RADIAL_SEGMENTS),
            this.ghostMarkerMaterial,
          );
          mesh.rotation.x = -Math.PI / 2;
          mesh.renderOrder = ASSIST_RENDER_ORDER;
          this.root.add(mesh);
          this.ghostMarkerPool.push(mesh);
        }
        mesh.visible = true;
        const fill = this.pieceColors?.[hint.player]?.fill ?? '#cccccc';
        this.ghostMarkerMaterial.color.set(fill);
        this.ghostMarkerMaterial.opacity = strong ? 0.52 : 0.34;
        mesh.scale.set(hint.marker.radius, hint.marker.radius, 1);
        mesh.position.set(p.x, GHOST_Y + 0.0002, p.z);
        markerIdx++;
      }
    }
  }

  private placeDots(cells: readonly number[], cellPosition: CellPosition, radius: number, material: THREE.Material) {
    this.hideAllDots();
    for (let i = 0; i < cells.length; i++) {
      let mesh = this.dotPool[i];
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.CircleGeometry(1, BOARD.RADIAL_SEGMENTS), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = ASSIST_RENDER_ORDER;
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
        mesh.renderOrder = ASSIST_RENDER_ORDER + 1;
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
    fromWorld?: { x: number; z: number },
    toWorld?: { x: number; z: number },
    worldOverride?: readonly { x: number; z: number }[],
  ): number {
    if (!cells || cells.length < 2) return 0;
    const points =
      worldOverride && worldOverride.length === cells.length
        ? worldOverride.map(w => new THREE.Vector3(w.x, y, w.z))
        : this.worldPointsFromCells(cells, cellPosition, y);
    if (fromWorld) points[0]!.set(fromWorld.x, y, fromWorld.z);
    if (toWorld) points[points.length - 1]!.set(toWorld.x, y, toWorld.z);
    return this.addSoftPolyline(group, points, halfWidth, material);
  }

  private addSoftPolyline(group: THREE.Group, points: THREE.Vector3[], halfWidth: number, material: THREE.Material): number {
    let segments = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-5) continue;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.001, halfWidth * 2), material);
      mesh.position.set((a.x + b.x) / 2, a.y, (a.z + b.z) / 2);
      mesh.rotation.y = Math.atan2(dz, dx);
      mesh.renderOrder = ASSIST_RENDER_ORDER;
      group.add(mesh);
      segments++;
    }
    return segments;
  }

  private setLastMove(last: BoardAssistState['lastMove'], cellPosition: CellPosition): number {
    if (!last) return 0;
    const pathCells = last.pathCells ?? [last.fromCell, last.toCell];
    const y = PATH_Y;
    const segments = this.setSoftPath(
      this.lastMoveGroup,
      pathCells,
      cellPosition,
      LAST_MOVE_HALF_WIDTH,
      this.lastMoveMaterial,
      y,
      undefined,
      undefined,
      last.pathWorld,
    );

    if (last.omitEndpointDots) return segments;

    const endpoints: { x: number; z: number }[] = [];
    if (!last.omitFromEndpoint) {
      const from =
        last.pathWorld?.[0] ?? { x: cellPosition(last.fromCell).x, z: cellPosition(last.fromCell).z };
      endpoints.push(from);
    }
    const to =
      last.pathWorld?.[last.pathWorld.length - 1] ?? {
        x: cellPosition(last.toCell).x,
        z: cellPosition(last.toCell).z,
      };
    endpoints.push(to);

    for (const ep of endpoints) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.055, BOARD.RADIAL_SEGMENTS), this.lastMoveDotMaterial);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(ep.x, DOT_Y + 0.0005, ep.z);
      dot.renderOrder = ASSIST_RENDER_ORDER;
      this.lastMoveGroup.add(dot);
    }
    return segments;
  }
}
