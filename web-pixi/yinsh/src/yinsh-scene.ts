import { Application, Container, Graphics } from "pixi.js";
import {
  allCoords,
  BOARD_PICK_RADIUS_FACTOR,
  coordKey,
  nearestCoord,
  rackSlotPosition,
  screenPoint,
  spacingForViewport,
  type Coord,
} from "./coords";
import {
  AnimatedBackground,
  PanZoomController,
  ScoreEffects,
  theme,
} from "@abstract/pixi-shared";
import type { GameController, VisualEvent } from "./game-controller";
import type { Player, RenderState } from "./types";

type PieceKind = "ring" | "marker";

type PieceView = {
  g: Graphics;
  kind: PieceKind;
  player: Player;
  coord: Coord;
};

export class YinshScene {
  readonly app: Application;
  private bg: AnimatedBackground;
  private world = new Container();
  private boardLayer = new Container();
  private pieceLayer = new Container();
  private fxLayer = new Container();
  private indicatorLayer = new Container();
  private rackLayer = new Container();
  private scoreFx: ScoreEffects;
  private pieces = new Map<string, PieceView>();
  private spacing = 80;
  private factor = 1;
  private camera = new PanZoomController();
  private hoverCoord: Coord | null = null;
  private highlightedRing: Coord | null = null;
  private ghostRing: Graphics | null = null;
  private controller: GameController;
  private statusEl: HTMLElement;
  private racked: { player: Player; slot: number; g: Graphics }[] = [];

  constructor(mount: HTMLElement, controller: GameController, statusEl: HTMLElement) {
    this.controller = controller;
    this.statusEl = statusEl;
    this.app = new Application();
    this.bg = new AnimatedBackground();
    this.scoreFx = new ScoreEffects();
  }

  async init(mount: HTMLElement) {
    await this.app.init({
      resizeTo: mount,
      backgroundAlpha: 0,
      antialias: true,
      preference: "webgl",
    });
    mount.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = "none";

    this.app.stage.addChild(this.bg);
    this.app.stage.addChild(this.world);
    this.world.addChild(this.boardLayer);
    this.world.addChild(this.rackLayer);
    this.world.addChild(this.fxLayer);
    this.fxLayer.addChild(this.scoreFx);
    this.world.addChild(this.indicatorLayer);
    this.world.addChild(this.pieceLayer);

    this.setupInput();
    this.app.ticker.add((t) => {
      const dt = t.deltaMS;
      this.bg.update(dt, this.app.screen.width, this.app.screen.height);
      this.scoreFx.update(dt, this.spacing, this.factor);
      this.layoutWorld();
    });
  }

  private setupInput() {
    const canvas = this.app.canvas;
    this.camera.attach(canvas, () => this.layoutWorld());

    canvas.addEventListener("pointermove", (e) => {
      if (this.camera.wasDragging()) return;
      this.updateHover(e.clientX, e.clientY);
    });
    canvas.addEventListener("pointerleave", () => {
      this.hoverCoord = null;
      this.drawIndicators(null);
    });
    canvas.addEventListener("click", (e) => {
      if (this.camera.wasDragging()) return;
      const coord = this.pickCoord(e.clientX, e.clientY);
      if (!coord) {
        void this.controller.cancelRingSelection();
        return;
      }
      void this.controller.humanClick(coord);
    });
  }

  private updateHover(clientX: number, clientY: number) {
    const coord = this.pickCoord(clientX, clientY);
    this.hoverCoord = coord;
    this.drawIndicators(coord);
    if (coord) {
      const state = this.controller.getState();
      if (state && typeof state.turn_mode === "object" && "RingMovement" in state.turn_mode) {
        this.updateGhostRing(coord, state);
      } else {
        this.clearGhost();
      }
    } else {
      this.clearGhost();
    }
  }

  private pickCoord(clientX: number, clientY: number): Coord | null {
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const local = this.world.toLocal({ x: sx, y: sy });
    const { coord, dist } = nearestCoord(local.x, local.y, this.spacing);
    if (dist > this.spacing * BOARD_PICK_RADIUS_FACTOR) return null;
    return coord;
  }

  handleState(state: RenderState, status: string, visual: VisualEvent[]) {
    this.statusEl.textContent = status;
    this.syncHighlight(state);
    if (visual.length === 0) {
      this.syncBoardFromState(state);
    } else {
      for (const v of visual) this.playVisual(v, state);
      window.setTimeout(
        () => this.syncBoardFromState(state),
        theme.animMs + 30,
      );
    }
    this.drawGrid();
    this.drawRacks(state);
  }

  private syncBoardFromState(state: RenderState) {
    const desired = new Map<string, PieceView>();

    const add = (coord: Coord, player: Player, kind: PieceKind) => {
      const key = `${kind}:${coordKey(coord)}:${player}`;
      let pv = this.pieces.get(key);
      if (!pv) {
        pv = { g: this.makePiece(kind, player), kind, player, coord };
        this.pieceLayer.addChild(pv.g);
        this.pieces.set(key, pv);
      }
      pv.coord = coord;
      const p = screenPoint(coord, this.spacing);
      pv.g.position.set(p.x, p.y);
      desired.set(key, pv);
    };

    for (const c of state.board.rings_a) add(c, "A", "ring");
    for (const c of state.board.rings_b) add(c, "B", "ring");
    for (const c of state.board.markers_a) add(c, "A", "marker");
    for (const c of state.board.markers_b) add(c, "B", "marker");

    for (const [key, pv] of this.pieces) {
      if (!desired.has(key)) {
        pv.g.destroy();
        this.pieces.delete(key);
      }
    }
    this.pieces = desired;
  }

  private playVisual(v: VisualEvent, state: RenderState) {
    switch (v.kind) {
      case "removeRun":
        this.scoreFx.showScoredLine(v.coords, this.spacing, this.factor);
        break;
      case "flipMarkers":
        for (const c of v.coords) {
          const keyA = `marker:${coordKey(c)}:A`;
          const keyB = `marker:${coordKey(c)}:B`;
          const pv = this.pieces.get(keyA) ?? this.pieces.get(keyB);
          if (pv) this.tweenMarkerFlip(pv);
        }
        break;
      case "moveRing":
        this.tweenPiece(v.from, v.to, "ring", v.player);
        break;
      case "removeRingToRack": {
        const dest = rackSlotPosition(
          v.player,
          v.slot,
          this.spacing,
          (this.app.screen.width / this.camera.zoom) * 0.5,
          this.factor,
        );
        this.tweenPieceTo(v.coord, dest, "ring", v.player, true);
        break;
      }
      default:
        break;
    }
    void state;
  }

  private tweenMarkerFlip(pv: PieceView) {
    const g = pv.g;
    const start = performance.now();
    const dur = theme.animMs / 5;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / dur);
      g.scale.set(1 + 0.15 * Math.sin(t * Math.PI));
      if (t < 1) requestAnimationFrame(tick);
      else g.scale.set(1);
    };
    requestAnimationFrame(tick);
    pv.player = pv.player === "A" ? "B" : "A";
    this.recolorPiece(g, pv.kind, pv.player);
  }

  private tweenPiece(
    from: Coord,
    to: Coord,
    kind: PieceKind,
    player: Player,
  ) {
    const key = [...this.pieces.keys()].find(
      (k) => k.startsWith(`${kind}:${coordKey(from)}:${player}`),
    );
    if (!key) return;
    const pv = this.pieces.get(key)!;
    const startP = screenPoint(from, this.spacing);
    const endP = screenPoint(to, this.spacing);
    const start = performance.now();
    const tick = () => {
      const t = easeInOut(Math.min(1, (performance.now() - start) / theme.animMs));
      pv.g.position.set(
        startP.x + (endP.x - startP.x) * t,
        startP.y + (endP.y - startP.y) * t,
      );
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    this.pieces.delete(key);
    const newKey = `${kind}:${coordKey(to)}:${player}`;
    pv.coord = to;
    this.pieces.set(newKey, pv);
  }

  private tweenPieceTo(
    from: Coord,
    dest: { x: number; y: number },
    kind: PieceKind,
    player: Player,
    toRack: boolean,
  ) {
    const key = [...this.pieces.keys()].find(
      (k) => k.startsWith(`${kind}:${coordKey(from)}:${player}`),
    );
    if (!key) return;
    const pv = this.pieces.get(key)!;
    const startP = screenPoint(from, this.spacing);
    const start = performance.now();
    const tick = () => {
      const t = easeInOut(Math.min(1, (performance.now() - start) / theme.animMs));
      pv.g.position.set(
        startP.x + (dest.x - startP.x) * t,
        startP.y + (dest.y - startP.y) * t,
      );
      if (t < 1) requestAnimationFrame(tick);
      else if (toRack) {
        pv.g.destroy();
        this.pieces.delete(key);
      }
    };
    requestAnimationFrame(tick);
  }

  private syncHighlight(state: RenderState) {
    this.highlightedRing = null;
    const tm = state.turn_mode;
    if (typeof tm === "object" && "RingMovement" in tm) {
      this.highlightedRing = tm.RingMovement;
    } else if (typeof tm === "object" && "WaitForRingMovement" in tm) {
      this.highlightedRing = tm.WaitForRingMovement;
    }
    for (const pv of this.pieces.values()) {
      if (pv.kind !== "ring") continue;
      const hl =
        this.highlightedRing &&
        pv.coord.x === this.highlightedRing.x &&
        pv.coord.y === this.highlightedRing.y &&
        pv.player === "A";
      this.recolorPiece(pv.g, pv.kind, pv.player, hl);
    }
  }

  private drawGrid() {
    this.boardLayer.removeChildren();
    const g = new Graphics();
    const coords = allCoords();
    const pts = coords.map((c) => screenPoint(c, this.spacing));

    if (pts.length > 2) {
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      const pad = this.spacing * 0.55;
      g.roundRect(
        minX - pad,
        minY - pad,
        maxX - minX + pad * 2,
        maxY - minY + pad * 2,
        8,
      ).fill({ color: theme.boardFill });
    }

    const lineW = 1.2 * this.factor;
    for (let x = -5; x <= 5; x++) {
      const row = coords.filter((c) => c.x === x);
      if (row.length < 2) continue;
      row.sort((a, b) => a.y - b.y);
      const a = screenPoint(row[0], this.spacing);
      const b = screenPoint(row[row.length - 1], this.spacing);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: lineW, color: theme.boardLine });
    }
    for (let y = -5; y <= 5; y++) {
      const row = coords.filter((c) => c.y === y);
      if (row.length < 2) continue;
      row.sort((a, b) => a.x - b.x);
      const a = screenPoint(row[0], this.spacing);
      const b = screenPoint(row[row.length - 1], this.spacing);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: lineW, color: theme.boardLine });
    }
    for (let d = -5; d <= 5; d++) {
      const row = coords.filter((c) => c.y === c.x + d);
      if (row.length < 2) continue;
      row.sort((a, b) => a.x - b.x);
      const a = screenPoint(row[0], this.spacing);
      const b = screenPoint(row[row.length - 1], this.spacing);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: lineW, color: theme.boardLine });
    }

    for (const c of coords) {
      const p = screenPoint(c, this.spacing);
      g.circle(p.x, p.y, 2.2 * this.factor).fill({ color: theme.boardLine, alpha: 0.55 });
    }

    this.boardLayer.addChild(g);
  }

  private drawRacks(state: RenderState) {
    this.rackLayer.removeChildren();
    this.racked = [];
    const halfW = (this.app.screen.width / this.camera.zoom) * 0.5;
    for (const player of ["A", "B"] as Player[]) {
      const scored = player === "A" ? state.points_a : state.points_b;
      for (let slot = 0; slot < 3; slot++) {
        const pos = rackSlotPosition(player, slot, this.spacing, halfW, this.factor);
        const outline = new Graphics();
        this.drawRingShape(outline, player, false, true);
        outline.position.set(pos.x, pos.y);
        outline.alpha = slot < scored ? 0.85 : 0.35;
        this.rackLayer.addChild(outline);
        if (slot < scored) {
          const fill = new Graphics();
          this.drawRingShape(fill, player, false, false);
          fill.position.set(pos.x, pos.y);
          this.rackLayer.addChild(fill);
          this.racked.push({ player, slot, g: fill });
        }
      }
    }
  }

  private drawIndicators(hover: Coord | null) {
    this.indicatorLayer.removeChildren();
    const state = this.controller.getState();
    if (!state) return;
    const g = new Graphics();
    if (typeof state.turn_mode === "object" && "RingMovement" in state.turn_mode) {
      for (const m of state.legal_moves) {
        if (m.type !== "moveRing") continue;
        const p = screenPoint(m.end, this.spacing);
        g.circle(p.x, p.y, this.spacing / 8).fill({ color: 0xffffff, alpha: 0.12 });
      }
    }
    if (hover) {
      const p = screenPoint(hover, this.spacing);
      g.circle(p.x, p.y, this.spacing / 6).stroke({
        width: 2,
        color: theme.hover,
        alpha: 0.85,
      });
    }
    this.indicatorLayer.addChild(g);
  }

  private updateGhostRing(coord: Coord, state: RenderState) {
    const legal = state.legal_moves.some(
      (m) => m.type === "moveRing" && m.end.x === coord.x && m.end.y === coord.y,
    );
    if (!legal) {
      this.clearGhost();
      return;
    }
    if (!this.ghostRing) {
      this.ghostRing = new Graphics();
      this.pieceLayer.addChild(this.ghostRing);
    }
    this.ghostRing.clear();
    this.drawRingShape(this.ghostRing, "A", true, false);
    const p = screenPoint(coord, this.spacing);
    this.ghostRing.position.set(p.x, p.y);
    this.ghostRing.alpha = 0.35;
  }

  private clearGhost() {
    this.ghostRing?.destroy();
    this.ghostRing = null;
  }

  private makePiece(kind: PieceKind, player: Player): Graphics {
    const g = new Graphics();
    this.drawPiece(g, kind, player, false);
    return g;
  }

  private drawPiece(
    g: Graphics,
    kind: PieceKind,
    player: Player,
    highlighted: boolean,
  ) {
    if (kind === "ring") this.drawRingShape(g, player, false, false, highlighted);
    else this.drawMarkerShape(g, player);
  }

  private recolorPiece(
    g: Graphics,
    kind: PieceKind,
    player: Player,
    highlighted = false,
  ) {
    g.clear();
    this.drawPiece(g, kind, player, highlighted);
  }

  private drawRingShape(
    g: Graphics,
    player: Player,
    ghost: boolean,
    outlineOnly: boolean,
    highlighted = false,
  ) {
    const inner = theme.ringInner * this.factor;
    const outer = theme.ringOuter * this.factor;
    const fill = player === "A" ? theme.playerA : theme.playerB;
    if (outlineOnly) {
      g.circle(0, 0, outer).stroke({ width: 1.5 * this.factor, color: theme.boardLine, alpha: 0.55 });
      return;
    }
    if (player === "B") {
      g.circle(0, 0, outer + 1).fill({ color: theme.playerBStroke });
    }
    g.circle(0, 0, outer).fill({ color: fill, alpha: ghost ? 0.35 : 1 });
    g.circle(0, 0, inner).cut();
    if (highlighted && player === "A") {
      g.circle(0, 0, outer + 3).stroke({ width: 3, color: theme.hover, alpha: 0.9 });
    }
  }

  private drawMarkerShape(g: Graphics, player: Player) {
    const r = theme.markerRadius * this.factor;
    const fill = player === "A" ? theme.playerA : theme.playerB;
    if (player === "B") {
      g.circle(0, 0, r + 1).fill({ color: theme.playerBStroke });
    }
    g.circle(0, 0, r).fill({ color: fill });
  }

  private layoutWorld() {
    this.spacing = spacingForViewport(
      this.app.screen.width / this.camera.zoom,
      this.app.screen.height / this.camera.zoom,
    );
    this.factor = this.spacing / 80;
    this.camera.applyToWorld(
      this.world,
      this.app.screen.width,
      this.app.screen.height,
    );
    this.bg.resize(this.app.screen.width, this.app.screen.height);
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
