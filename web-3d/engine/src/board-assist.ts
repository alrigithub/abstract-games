import * as THREE from 'three';
import { BOARD } from './constants';
import { getProjectedShadowTexture } from './projected-shadow-texture';
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
const RUN_ROW_HALF_WIDTH = 0.052;
const DEFAULT_MARKER_RADIUS = 0.31;
const DEFAULT_HALO_SCALE = 2.2;
const DEFAULT_MARKER_GHOST_SURFACE_Y = 0.016;
const ASSIST_RENDER_ORDER = 0;
/** Marker-centre previews draw above rings and seated stones. */
const MARKER_GHOST_RENDER_ORDER = 10;
/** Row celebration halos sit on the board plane under stone markers (renderOrder 2). */
const RUN_HALO_RENDER_ORDER = 0;
const SHADOW_MAX_OPACITY = 0.3;
const SHADOW_PLANE = new THREE.PlaneGeometry(1, 1);

function createWarmCelebrationDiscTexture(): THREE.CanvasTexture | null {
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
  private readonly runMarkerOuterPool: THREE.Mesh[] = [];
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
  private lastStats: BoardAssistStats = {
    visibleMeshCount: 0,
    pathSegmentCount: 0,
    markerGhostCount: 0,
    markerGhostMinOpacity: 0,
    runGlowCellCount: 0,
  };
  private markerGhostSurfaceY = DEFAULT_MARKER_GHOST_SURFACE_Y;
  private lightTable = true;
  private runPulseActive = false;
  private runHaloRadius = DEFAULT_MARKER_RADIUS * DEFAULT_HALO_SCALE;
  private runGlowTexture: THREE.CanvasTexture | null = null;
  private accentColor = WIN_ACCENT;
  private runCelebrationColor = '#ffb347';
  private shadowTint = 0x19232e;

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
      color: this.shadowTint,
      transparent: true,
      opacity: SHADOW_MAX_OPACITY,
      depthWrite: false,
      depthTest: true,
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
      opacity: 0.48,
      depthWrite: false,
      depthTest: false,
    });
    this.runGlowTexture = createWarmCelebrationDiscTexture();
    this.runMarkerMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      depthTest: false,
      map: this.runGlowTexture ?? undefined,
    });
    this.runPathMaterial = new THREE.MeshBasicMaterial({
      color: WIN_ACCENT,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      depthTest: false,
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

  /** True while row-glow pulse animation should keep the render loop alive. */
  needsContinuousRender(): boolean {
    return this.runPulseActive;
  }

  /** Gentle pulse on row halos; returns true when active. */
  tick(now: number): boolean {
    if (!this.runPulseActive) return false;
    const pulse = 0.92 + 0.08 * Math.sin(now * 0.0042);
    const scale = 1 + 0.05 * Math.sin(now * 0.0042 + 1.1);
    const r = this.runHaloRadius;
    for (const mesh of this.runMarkerOuterPool) {
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
    for (const m of this.dotPool) m.geometry.dispose();
    for (const m of this.ringPool) m.geometry.dispose();
    for (const m of this.ghostRingPool) m.geometry.dispose();
    for (const m of this.ghostMarkerPool) m.geometry.dispose();
    for (const m of this.runMarkerPool) m.geometry.dispose();
    for (const m of this.runMarkerOuterPool) m.geometry.dispose();
    for (const m of this.ringPickPool) m.geometry.dispose();
    if (this.runGlowTexture) this.runGlowTexture.dispose();
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
    this.accentColor = accent;
    this.runCelebrationColor = tokens.runCelebration;
    this.runMarkerMaterial.color.set(tokens.runCelebration);
    this.ringPickMaterial.color.set(accent);
    this.shadowTint = new THREE.Color(tokens.shadow).getHex();
    this.shadowMaterial.color.set(tokens.shadow);
    this.lightTable = tokens.table === '#f3f1ec';
  }

  private markerPreviewColor(player: string): THREE.Color {
    const fill = (this.pieceColors?.[player]?.fill ?? '#cccccc').toLowerCase();
    if (this.lightTable && fill === '#ffffff') return new THREE.Color('#b8aa96');
    if (!this.lightTable && fill === '#000000') return new THREE.Color('#3a3a3a');
    return new THREE.Color(this.pieceColors?.[player]?.fill ?? '#cccccc');
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
      this.lastStats = {
        visibleMeshCount: 0,
        pathSegmentCount: 0,
        markerGhostCount: 0,
        markerGhostMinOpacity: 0,
        runGlowCellCount: 0,
      };
      return;
    }

    this.root.visible = true;
    this.markerGhostSurfaceY = state.markerGhostSurfaceY ?? DEFAULT_MARKER_GHOST_SURFACE_Y;

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

    this.placeShadows(state.shadows ?? [], cellPosition);
    this.placeGhosts(state.ghosts ?? [], cellPosition);
    this.placeMarkerGhost(state.markerGhost, cellPosition);
    const style = state.runGlowStyle;
    this.runHaloRadius =
      (style?.markerRadius ?? DEFAULT_MARKER_RADIUS) * (style?.haloScale ?? DEFAULT_HALO_SCALE);
    this.runPulseActive = (state.runGlows?.length ?? 0) > 0;
    this.placeRunGlows(state.runGlows ?? [], cellPosition);
    this.placeRingPickGlows(state.ringPickGlows ?? [], cellPosition);

    const ghostStats = this.collectMarkerGhostStats();
    this.lastStats = {
      visibleMeshCount: this.countVisibleMeshes(),
      pathSegmentCount: 0,
      ...ghostStats,
      runGlowCellCount: this.countVisibleRunGlowCells(),
    };
  }

  private collectMarkerGhostStats(): Pick<BoardAssistStats, 'markerGhostCount' | 'markerGhostMinOpacity'> {
    let count = 0;
    let minOpacity = 1;
    for (const mesh of this.ghostMarkerPool) {
      if (!mesh.visible) continue;
      count++;
      const mat = mesh.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        minOpacity = Math.min(minOpacity, mat.opacity);
      }
    }
    return { markerGhostCount: count, markerGhostMinOpacity: count ? minOpacity : 0 };
  }

  private countVisibleRunGlowCells(): number {
    let n = 0;
    for (const mesh of this.runMarkerOuterPool) {
      if (mesh.visible) n++;
    }
    return n;
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
    count(this.runMarkerOuterPool);
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
    for (const m of this.runMarkerOuterPool) m.visible = false;
  }

  private hideAllRingPicks() {
    for (const m of this.ringPickPool) m.visible = false;
  }

  private runHaloOpacity(strength: AssistRunRowGlow['strength'], highlighted: boolean): number {
    if (highlighted && strength === 'hover') return 0.84;
    if (highlighted) return 0.76;
    switch (strength) {
      case 'hover':
        return 0.72;
      case 'option':
        return 0.5;
      default:
        return 0.74;
    }
  }

  private placeRunGlows(rows: readonly AssistRunRowGlow[], cellPosition: CellPosition) {
    this.hideAllRunMarkers();
    type CellGlow = { strength: AssistRunRowGlow['strength']; highlight: boolean };
    const markerStrength = new Map<number, CellGlow>();
    const rank = (s: AssistRunRowGlow['strength']) => (s === 'hover' ? 2 : s === 'option' ? 1 : 0);
    const highlightSet = new Set<number>();

    for (const row of rows) {
      const rowHighlights = new Set(row.highlightCells ?? row.markerCells);
      for (const cell of row.markerCells) {
        const highlight = rowHighlights.has(cell);
        if (highlight) highlightSet.add(cell);
        const prev = markerStrength.get(cell);
        if (!prev || rank(row.strength) > rank(prev.strength)) {
          markerStrength.set(cell, { strength: row.strength, highlight });
        } else if (prev && highlight) {
          markerStrength.set(cell, { ...prev, highlight: true });
        }
      }
    }

    let outerIdx = 0;
    for (const [cell, meta] of markerStrength) {
      const highlighted = meta.highlight || highlightSet.has(cell);
      const p = cellPosition(cell);
      const y = BOARD.PLAYFIELD_SURFACE_Y + 0.0008;

      let outer = this.runMarkerOuterPool[outerIdx];
      if (!outer) {
        outer = new THREE.Mesh(new THREE.CircleGeometry(1, BOARD.RADIAL_SEGMENTS), this.runMarkerMaterial.clone());
        outer.rotation.x = -Math.PI / 2;
        outer.renderOrder = RUN_HALO_RENDER_ORDER;
        this.root.add(outer);
        this.runMarkerOuterPool.push(outer);
      }
      outer.visible = true;
      const outerMat = this.runMarkerMaterial.clone();
      outerMat.color.set(this.runCelebrationColor);
      const baseOpacity = this.runHaloOpacity(meta.strength, highlighted);
      outerMat.opacity = baseOpacity;
      outerMat.depthTest = true;
      outerMat.depthWrite = false;
      outer.material = outerMat;
      outer.userData.runHaloBaseOpacity = baseOpacity;
      outer.scale.set(this.runHaloRadius, this.runHaloRadius, 1);
      outer.position.set(p.x, y, p.z);
      outerIdx++;
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

  private shadowOpacity(strength: AssistShadowHint['strength']): number {
    switch (strength) {
      case 'hover':
        return SHADOW_MAX_OPACITY;
      case 'legal':
        return SHADOW_MAX_OPACITY * 0.55;
      default:
        return SHADOW_MAX_OPACITY * 0.75;
    }
  }

  private placeShadows(shadows: readonly AssistShadowHint[], cellPosition: CellPosition) {
    this.hideAllShadows();
    for (let i = 0; i < shadows.length; i++) {
      const hint = shadows[i]!;
      let mesh = this.shadowPool[i];
      if (!mesh) {
        mesh = new THREE.Mesh(SHADOW_PLANE, this.shadowMaterial.clone());
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = ASSIST_RENDER_ORDER;
        this.root.add(mesh);
        this.shadowPool.push(mesh);
      }
      mesh.visible = true;
      const diameter = hint.footprint.outerRadius * 2;
      mesh.scale.set(diameter, diameter, 1);
      const mat = this.shadowMaterial.clone();
      mat.color.set(this.shadowTint);
      mat.opacity = this.shadowOpacity(hint.strength);
      const tex = getProjectedShadowTexture(hint.footprint);
      mat.map = tex;
      mat.needsUpdate = true;
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
          mesh = new THREE.Mesh(new THREE.CircleGeometry(1, BOARD.RADIAL_SEGMENTS), this.ghostMarkerMaterial.clone());
          mesh.rotation.x = -Math.PI / 2;
          mesh.renderOrder = MARKER_GHOST_RENDER_ORDER;
          this.root.add(mesh);
          this.ghostMarkerPool.push(mesh);
        }
        mesh.visible = true;
        const fill = this.pieceColors?.[hint.player]?.fill ?? '#cccccc';
        const mat =
          mesh.material instanceof THREE.MeshBasicMaterial
            ? mesh.material
            : this.ghostMarkerMaterial.clone();
        mat.color.copy(this.markerPreviewColor(hint.player));
        mat.opacity = strong ? 0.68 : 0.56;
        mat.depthWrite = false;
        mat.depthTest = false;
        mesh.material = mat;
        mesh.renderOrder = MARKER_GHOST_RENDER_ORDER;
        mesh.scale.set(hint.marker.radius, hint.marker.radius, 1);
        mesh.position.set(p.x, this.markerGhostSurfaceY, p.z);
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
