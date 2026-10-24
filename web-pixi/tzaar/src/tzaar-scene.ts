import { Application, Container, Graphics, Text } from "pixi.js";
import {
  AnimatedBackground,
  WinEffects,
  applyCameraToContainer,
  attachPixiStageInput,
  drawHexBoard,
  drawHoverRing,
  drawLegalTarget,
  drawSelectionPulse,
  screenToWorld,
  spacingForViewport,
  theme,
  type CameraState,
} from "@abstract/pixi-shared";
import {
  allPlayableCoords,
  boardOrigin,
  nearestPlayable,
  screenPoint,
  type Coord,
} from "./coords";
import type { GameController, VisualEvent } from "./game-controller";
import {
  PIECE_LABEL,
  type PieceJson,
  type PieceKind,
  type Player,
  type RenderState,
} from "./types";

const R_TZAAR = 20;
const R_TZARRA = 15.5;
const R_TOTT = 11;

type StackView = {
  root: Container;
  coord: Coord;
};

export class TzaarScene {
  readonly app: Application;
  private bg: AnimatedBackground;
  private world = new Container();
  private boardLayer = new Container();
  private pieceLayer = new Container();
  private indicatorLayer = new Container();
  private fxLayer = new Container();
  private winFx: WinEffects;
  private stacks = new Map<string, StackView>();
  private spacing = 58;
  private factor = 1;
  private camera: CameraState = { x: 0, y: 0, zoom: 1 };
  private pulseT = 0;
  private selected: Coord | null = null;
  private controller: GameController;
  private statusEl: HTMLElement;
  private passBtn: HTMLButtonElement;

  constructor(
    mount: HTMLElement,
    controller: GameController,
    statusEl: HTMLElement,
    passBtn: HTMLButtonElement,
  ) {
    this.controller = controller;
    this.statusEl = statusEl;
    this.passBtn = passBtn;
    this.app = new Application();
    this.bg = new AnimatedBackground();
    this.winFx = new WinEffects();
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
    this.world.addChild(this.fxLayer);
    this.fxLayer.addChild(this.winFx);
    this.world.addChild(this.indicatorLayer);
    this.world.addChild(this.pieceLayer);

    attachPixiStageInput({
      host: mount,
      getCamera: () => this.camera,
      setCamera: (s) => {
        this.camera = s;
      },
      onCameraChange: () => this.layoutWorld(),
    });

    this.app.canvas.addEventListener("pointermove", (e) => {
      this.drawIndicators(e.clientX, e.clientY);
    });
    this.app.canvas.addEventListener("pointerleave", () => {
      this.indicatorLayer.removeChildren();
    });
    this.app.canvas.addEventListener("click", (e) => {
      const coord = this.pickCoord(e.clientX, e.clientY);
      if (coord) void this.controller.humanClick(coord);
    });
    this.app.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      void this.controller.passSecond();
    });

    this.app.ticker.add((t) => {
      const dt = t.deltaMS;
      this.pulseT += dt / 1000;
      this.bg.update(dt, this.app.screen.width, this.app.screen.height);
      this.winFx.update(dt);
      this.layoutWorld();
      if (this.selected) this.redrawSelectionPulse();
    });
  }

  handleUpdate(ev: {
    state: RenderState;
    status: string;
    visual: VisualEvent[];
    selected: Coord | null;
  }) {
    this.statusEl.textContent = ev.status;
    this.selected = ev.selected;
    this.passBtn.disabled = !ev.state.can_pass || !ev.state.human_turn;

    if (ev.state.winner && ev.visual.length === 0) {
      this.playWinFx(ev.state);
    }

    for (const v of ev.visual) {
      if (v.kind === "action") {
        this.animateAction(v.from, v.to, v.capture);
      }
    }

    if (ev.visual.length === 0) {
      this.syncStacks(ev.state);
    } else {
      window.setTimeout(
        () => this.syncStacks(ev.state),
        theme.animMs + 40,
      );
    }

    this.drawGrid();
    this.drawIndicators(null, null);
  }

  private playWinFx(state: RenderState) {
    const coords = allPlayableCoords().filter((c) => {
      const cell = state.board.stacks[c.y * 9 + c.x];
      if (!cell?.pieces.length) return false;
      const owner = cell.pieces[0].player;
      return state.winner === owner;
    });
    if (coords.length) {
      this.winFx.showPoints(coords, this.spacing, this.factor, (c, sp) =>
        this.boardPoint(c, sp),
      );
    }
  }

  private boardPoint(c: Coord, spacing: number) {
    const o = boardOrigin(allPlayableCoords(), spacing, "tzaar");
    const p = screenPoint(c, spacing);
    return { x: p.x + o.x, y: p.y + o.y };
  }

  private syncStacks(state: RenderState) {
    const desired = new Set<string>();
    for (const coord of allPlayableCoords()) {
      const cell = state.board.stacks[coord.y * 9 + coord.x];
      if (!cell?.pieces.length) continue;
      const key = `${coord.x},${coord.y}`;
      desired.add(key);
      let view = this.stacks.get(key);
      if (!view) {
        view = { root: new Container(), coord };
        this.pieceLayer.addChild(view.root);
        this.stacks.set(key, view);
      }
      view.coord = coord;
      this.drawStack(view.root, cell.pieces);
      const p = this.boardPoint(coord, this.spacing);
      view.root.position.set(p.x, p.y);
    }
    for (const [key, view] of this.stacks) {
      if (!desired.has(key)) {
        view.root.destroy({ children: true });
        this.stacks.delete(key);
      }
    }
  }

  private drawStack(root: Container, pieces: PieceJson[]) {
    root.removeChildren();
    const zStep = 3.2 * this.factor;
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const g = new Graphics();
      this.drawPieceShape(g, piece.kind, piece.player, i === pieces.length - 1);
      g.y = -i * zStep;
      root.addChild(g);
    }
    if (pieces.length > 1) {
      const label = new Text({
        text: String(pieces.length),
        style: {
          fill: 0x111111,
          fontSize: 11 * this.factor,
          fontFamily: "system-ui, sans-serif",
          fontWeight: "600",
        },
      });
      label.anchor.set(0.5);
      label.y = -pieces.length * zStep - 10 * this.factor;
      root.addChild(label);
    }
  }

  private drawPieceShape(
    g: Graphics,
    kind: PieceKind,
    player: Player,
    showLabel: boolean,
  ) {
    const r =
      (kind === "Tzaar" ? R_TZAAR : kind === "Tzarra" ? R_TZARRA : R_TOTT) *
      this.factor;
    const fill = player === "First" ? theme.playerA : theme.playerB;
    if (player === "Second") {
      g.circle(0, 0, r + 1).fill({ color: theme.playerBStroke });
    }
    g.circle(0, 0, r).fill({ color: fill });
    if (kind === "Tzaar") {
      g.circle(0, 0, r * 0.55).stroke({ width: 1.5 * this.factor, color: fill });
      g.circle(0, 0, r * 0.35).stroke({ width: 1.2 * this.factor, color: fill });
    } else if (kind === "Tzarra") {
      g.circle(0, 0, r * 0.45).stroke({ width: 1.5 * this.factor, color: fill });
    }
    if (showLabel) {
      const t = new Text({
        text: PIECE_LABEL[kind].slice(0, 3),
        style: {
          fill: player === "First" ? 0xf5f5f5 : 0x111111,
          fontSize: 9 * this.factor,
          fontFamily: "system-ui, sans-serif",
          fontWeight: "700",
        },
      });
      t.anchor.set(0.5);
      g.addChild(t);
    }
  }

  private animateAction(from: Coord, to: Coord, capture: boolean) {
    const fromKey = `${from.x},${from.y}`;
    const view = this.stacks.get(fromKey);
    if (!view) return;
    const start = this.boardPoint(from, this.spacing);
    const end = this.boardPoint(to, this.spacing);
    const root = view.root;
    const t0 = performance.now();
    const tick = () => {
      const t = easeInOut(Math.min(1, (performance.now() - t0) / theme.animMs));
      root.position.set(
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t,
      );
      if (t < 1) requestAnimationFrame(tick);
      else if (capture) {
        root.alpha = 0.4;
        setTimeout(() => {
          root.alpha = 1;
        }, 120);
      }
    };
    requestAnimationFrame(tick);
  }

  private pickCoord(clientX: number, clientY: number): Coord | null {
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const vp = {
      width: this.app.screen.width,
      height: this.app.screen.height,
    };
    const world = screenToWorld(this.camera, sx, sy, vp);
    const o = boardOrigin(allPlayableCoords(), this.spacing, "tzaar");
    return nearestPlayable(world.x - o.x, world.y - o.y, this.spacing);
  }

  private drawGrid() {
    this.boardLayer.removeChildren();
    const g = new Graphics();
    const coords = allPlayableCoords();
    drawHexBoard(g, coords, this.spacing, this.factor, "tzaar", "tzaar");
    const o = boardOrigin(coords, this.spacing, "tzaar");
    this.boardLayer.position.set(o.x, o.y);
    this.pieceLayer.position.set(o.x, o.y);
    this.indicatorLayer.position.set(o.x, o.y);
    this.boardLayer.addChild(g);
  }

  private drawIndicators(clientX: number | null, clientY: number | null) {
    this.indicatorLayer.removeChildren();
    const state = this.controller.getState();
    if (!state) return;
    const g = new Graphics();

    if (this.selected) {
      const targets = state.legal_moves.filter(
        (m) =>
          m.type === "action" &&
          m.from.x === this.selected!.x &&
          m.from.y === this.selected!.y,
      );
      for (const m of targets) {
        if (m.type !== "action") continue;
        const p = screenPoint(m.to, this.spacing);
        drawLegalTarget(g, p.x, p.y, this.spacing / 7);
      }
    }

    if (clientX != null && clientY != null) {
      const coord = this.pickCoord(clientX, clientY);
      if (coord) {
        const p = screenPoint(coord, this.spacing);
        drawHoverRing(g, p.x, p.y, this.spacing / 6);
      }
    }
    this.indicatorLayer.addChild(g);
  }

  private redrawSelectionPulse() {
    if (!this.selected) return;
    const existing = this.indicatorLayer.children[0] as Graphics | undefined;
    if (!existing) return;
    const p = screenPoint(this.selected, this.spacing);
    existing.clear();
    drawSelectionPulse(existing, p.x, p.y, this.spacing / 5, this.pulseT);
    const state = this.controller.getState();
    if (state) {
      for (const m of state.legal_moves) {
        if (m.type !== "action") continue;
        if (m.from.x !== this.selected.x || m.from.y !== this.selected.y) continue;
        const tp = screenPoint(m.to, this.spacing);
        drawLegalTarget(existing, tp.x, tp.y, this.spacing / 7);
      }
    }
  }

  private layoutWorld() {
    this.spacing = spacingForViewport(
      this.app.screen.width / this.camera.zoom,
      this.app.screen.height / this.camera.zoom,
      58,
    );
    this.factor = this.spacing / 58;
    applyCameraToContainer(this.world, this.camera, {
      width: this.app.screen.width,
      height: this.app.screen.height,
    });
    this.bg.resize(this.app.screen.width, this.app.screen.height);
    const state = this.controller.getState();
    if (state) this.syncStacks(state);
    this.drawGrid();
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
