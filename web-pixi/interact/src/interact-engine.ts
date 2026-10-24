import { Application, Container, Graphics, Text } from "pixi.js";
import { drawBoardShadow, makeContactShadow } from "./draw/contact-shadow.ts";
import { createPointerInteraction } from "./interaction/pointer-interaction.ts";
import { ObjectPool } from "./pool.ts";
import { TweenScheduler } from "./scheduler.ts";
import { takeTopSuffix } from "./stack-model.ts";
import {
  LIGHT_SOFT_THEME,
  TRAY_THEME,
  boardSlabPx,
  lineWidthPx,
  type InteractTheme,
} from "./theme/palette.ts";
import { contactShadowTexture } from "./draw/contact-shadow.ts";
import {
  drawPiece,
  pieceStackOffsetPitch,
  type DemoPieceKind,
} from "./theme/piece-drawings.ts";
import {
  BOUNCE_BACK_DURATION_MS,
  CARRIED_HORIZONTAL_DELAY_MS,
  CARRIED_HORIZONTAL_DURATION_MS,
  GHOST_ALPHA,
  LIFT_PITCH_FRACTION,
  PICKUP_SCALE,
  PICKUP_TILT_RAD,
  PIECE_LIFT_DURATION_MS,
  PIECE_MOVE_DURATION_MS,
  PLACE_SETTLE_DURATION_MS,
  SPREAD_STAGGER_MS,
} from "./tak-feel-constants.ts";
import type {
  InteractHooks,
  InteractionView,
  PieceInstance,
  PickSource,
  PlayerSide,
  Selection,
} from "./types.ts";
import { applyLiftShadow } from "./draw/contact-shadow.ts";

export interface InteractEngineOptions {
  mount: HTMLElement;
  boardSize: number;
  cellPitchPx?: number;
  hooks?: Partial<InteractHooks>;
  /** Piece ids per cell index (bottom → top). */
  initialCells?: string[][];
  pieceCatalog?: Map<string, PieceInstance>;
  theme?: InteractTheme;
}

interface PieceNode {
  root: Container;
  art: Graphics;
  shadow: ReturnType<typeof makeContactShadow>;
  id: string;
  cell: number;
  lift: number;
  scale: number;
  rotation: number;
  dirty: boolean;
}

export class InteractEngine {
  readonly app: Application;
  readonly scheduler = new TweenScheduler();
  private readonly mount: HTMLElement;
  private readonly boardSize: number;
  private readonly pitch: number;
  private readonly stageRoot = new Container();
  private readonly boardLayer = new Container();
  private readonly shadowLayer = new Container();
  private readonly pieceLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly highlightGfx = new Graphics();
  private readonly ghostLayer = new Container();
  private boardShadow = new Graphics();
  private boardGrid = new Graphics();
  private trayGfx = new Graphics();
  private trayLabels: Text[] = [];
  private pieces = new Map<string, PieceNode>();
  private pool: ObjectPool<PieceNode>;
  private cells: string[][] = [];
  private trays: Record<PlayerSide, number> = { A: 5, B: 5 };
  private pieceMeta = new Map<string, PieceInstance>();
  private view: InteractionView = {
    selection: null,
    dragging: false,
    pointer: null,
    hoverCell: null,
    progress: 0,
  };
  private layoutDirty = true;
  private interaction: ReturnType<typeof createPointerInteraction> | null = null;
  private hooks: InteractHooks;
  private theme: InteractTheme = LIGHT_SOFT_THEME;

  constructor(options: InteractEngineOptions) {
    this.mount = options.mount;
    this.boardSize = options.boardSize;
    this.pitch = options.cellPitchPx ?? 56;
    this.pool = new ObjectPool(
      () => this.createPieceNode(),
      (n) => {
        n.root.visible = false;
        n.lift = 0;
        n.scale = 1;
        n.rotation = 0;
        n.dirty = true;
      },
    );
    this.hooks = {
      getCells: () => this.cells,
      getTray: (s) => this.trays[s],
      legalTargets: () => [],
      canPick: () => true,
      onCommit: () => true,
      ...options.hooks,
    };
    this.theme = options.theme ?? LIGHT_SOFT_THEME;
    this.app = new Application();
    void this.init(options);
  }

  getTheme(): InteractTheme {
    return this.theme;
  }

  setTheme(theme: InteractTheme): void {
    this.theme = theme;
    this.app.renderer.background.color = theme.stageBg;
    for (const node of this.pieces.values()) {
      node.shadow.texture = contactShadowTexture(theme);
      node.dirty = true;
    }
    this.layoutDirty = true;
  }

  private async init(options: InteractEngineOptions): Promise<void> {
    await this.app.init({
      background: this.theme.stageBg,
      resizeTo: this.mount,
      antialias: true,
      autoDensity: true,
      resolution: 1,
    });
    this.mount.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = "none";

    this.stageRoot.addChild(this.shadowLayer, this.boardLayer, this.pieceLayer, this.overlayLayer);
    this.boardLayer.addChild(this.boardShadow, this.boardGrid, this.trayGfx);
    this.overlayLayer.addChild(this.highlightGfx, this.ghostLayer);
    this.app.stage.addChild(this.stageRoot);

    this.cells =
      options.initialCells?.map((c) => c.slice()) ??
      Array.from({ length: this.boardSize * this.boardSize }, () => []);
    if (options.pieceCatalog) {
      for (const [id, meta] of options.pieceCatalog) this.pieceMeta.set(id, meta);
    }
    this.cells.forEach((stack, cell) => {
      for (const id of stack) {
        const meta = this.pieceMeta.get(id);
        if (meta) this.mountPiece(meta, cell);
      }
    });

    this.interaction = createPointerInteraction({
      element: this.app.canvas,
      hooks: {
        ...this.hooks,
        onCommit: (sel, target) => this.handleCommit(sel, target),
      },
      hitCell: (x, y) => this.hitCell(x, y),
      hitTray: (x, y) => this.hitTray(x, y),
      onView: (v) => {
        this.view = v;
        this.layoutDirty = true;
      },
    });

    this.app.ticker.add(() => {
      this.scheduler.tick(this.app.ticker.deltaMS);
      if (this.layoutDirty) {
        this.redraw();
        this.layoutDirty = false;
      }
    });

    window.addEventListener("resize", () => {
      this.layoutDirty = true;
    });
    this.layoutDirty = true;
  }

  setHooks(hooks: Partial<InteractHooks>): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  setTray(side: PlayerSide, count: number): void {
    this.trays[side] = count;
    this.layoutDirty = true;
  }

  /** Animate an AI move through the same pipeline as human commits. */
  async animateMove(
    from: PickSource,
    to: number,
    count: number,
    arc = true,
  ): Promise<void> {
    const sel: Selection = { source: from, count };
    await this.runMoveAnimation(sel, to, arc, true);
  }

  private createPieceNode(): PieceNode {
    const root = new Container();
    const shadow = makeContactShadow(this.theme);
    const art = new Graphics();
    root.addChild(shadow, art);
    return {
      root,
      art,
      shadow,
      id: "",
      cell: 0,
      lift: 0,
      scale: 1,
      rotation: 0,
      dirty: true,
    };
  }

  private mountPiece(meta: PieceInstance, cell: number): void {
    const node = this.pool.acquire();
    node.id = meta.id;
    node.cell = cell;
    node.root.visible = true;
    this.pieces.set(meta.id, node);
    this.pieceLayer.addChild(node.root);
    this.syncPieceTransform(node, meta);
    node.dirty = false;
  }

  private syncPieceTransform(node: PieceNode, meta: PieceInstance): void {
    const pos = this.cellCenter(node.cell);
    const stackIndex = (this.cells[node.cell] ?? []).indexOf(node.id);
    const yOff =
      stackIndex <= 0
        ? 0
        : stackIndex * pieceStackOffsetPitch(meta.kind) * this.pitch;
    node.root.x = pos.x;
    node.root.y = pos.y - yOff - node.lift * LIFT_PITCH_FRACTION * this.pitch;
    drawPiece(node.art, meta.kind, meta.side, this.pitch, this.theme);
    const r = this.pitch * 0.36;
    node.shadow.position.set(0, this.pitch * 0.08);
    applyLiftShadow(node.shadow, this.theme, node.lift, r);
    node.root.scale.set(node.scale);
    node.root.rotation = node.rotation;
  }

  private boardOrigin(): { x: number; y: number } {
    const w = this.boardSize * this.pitch;
    const h = w;
    return {
      x: (this.app.screen.width - w) / 2 + w / 2,
      y: (this.app.screen.height - h) / 2 + h / 2 + 8,
    };
  }

  private cellCenter(index: number): { x: number; y: number } {
    const { x: ox, y: oy } = this.boardOrigin();
    const row = Math.floor(index / this.boardSize);
    const col = index % this.boardSize;
    const half = (this.boardSize - 1) / 2;
    return {
      x: ox + (col - half) * this.pitch,
      y: oy + (row - half) * this.pitch,
    };
  }

  private hitCell(clientX: number, clientY: number): number | null {
    const rect = this.app.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { x: ox, y: oy } = this.boardOrigin();
    const half = (this.boardSize - 1) / 2;
    const col = Math.round((x - ox) / this.pitch + half);
    const row = Math.round((y - oy) / this.pitch + half);
    if (row < 0 || col < 0 || row >= this.boardSize || col >= this.boardSize) return null;
    return row * this.boardSize + col;
  }

  private hitTray(clientX: number, clientY: number): PickSource | null {
    const rect = this.app.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const { x: ox } = this.boardOrigin();
    const w = this.boardSize * this.pitch;
    const left = ox - w / 2 - TRAY_THEME.gapFromBoardPitch * this.pitch - TRAY_THEME.slotPitch * this.pitch;
    const right = ox + w / 2 + TRAY_THEME.gapFromBoardPitch * this.pitch;
    if (x < left - 20 || x > right + TRAY_THEME.slotPitch * this.pitch + 20) return null;
    const side: PlayerSide = x < ox ? "A" : "B";
    const slot = 0;
    if (this.trays[side] <= 0) return null;
    return { type: "tray", side, slot };
  }

  private handleCommit(sel: Selection, target: number): boolean {
    const legal = this.hooks.legalTargets(sel);
    if (!legal.includes(target)) {
      void this.runBounceBack(sel);
      return false;
    }
    const ok = this.hooks.onCommit(sel, target);
    if (!ok) {
      void this.runBounceBack(sel);
      return false;
    }
    this.cells = this.hooks.getCells().map((c) => c.slice());
    void this.runMoveAnimation(sel, target, true, false);
    return true;
  }

  private async runBounceBack(sel: Selection): Promise<void> {
    const ids = this.selectedIds(sel);
    await this.scheduler.enqueue({
      label: "bounce",
      tweens: ids.flatMap((id, i) => {
        const node = this.pieces.get(id);
        if (!node) return [];
        const ox = node.root.x;
        const oy = node.root.y;
        return [
          {
            from: 0,
            to: 1,
            durationMs: BOUNCE_BACK_DURATION_MS,
            delayMs: i * SPREAD_STAGGER_MS,
            ease: "outBack" as const,
            onUpdate: (t) => {
              node.root.x = ox + Math.sin(t * Math.PI) * this.pitch * 0.15;
              node.lift = (1 - t) * LIFT_PITCH_FRACTION;
              node.dirty = true;
            },
          },
        ];
      }),
    });
  }

  private selectedIds(sel: Selection): string[] {
    if (sel.source.type === "cell") {
      const stack = this.cells[sel.source.index] ?? [];
      return takeTopSuffix(stack, sel.count);
    }
    const side = sel.source.side;
    return Array.from({ length: sel.count }, (_, i) => `tray-${side}-${i}-${Date.now()}`);
  }

  private async runMoveAnimation(
    sel: Selection,
    target: number,
    arc: boolean,
    fromAi: boolean,
  ): Promise<void> {
    const ids =
      sel.source.type === "cell"
        ? takeTopSuffix(this.cells[sel.source.index] ?? [], sel.count)
        : this.spawnFromTray(sel);

    const targetPos = this.cellCenter(target);
    const tweens = ids.map((id, i) => {
      const node = this.pieces.get(id);
      if (!node) return null;
      const meta = this.pieceMeta.get(id)!;
      const fromX = node.root.x;
      const fromY = node.root.y;
      const delay = i * SPREAD_STAGGER_MS + (fromAi ? 0 : CARRIED_HORIZONTAL_DELAY_MS);
      const liftPx = LIFT_PITCH_FRACTION * this.pitch;
      return {
        lift: { node, meta, fromX, fromY, delay, liftPx, arc },
        settle: { node, targetPos, i },
      };
    }).filter(Boolean) as Array<{
      lift: {
        node: PieceNode;
        meta: PieceInstance;
        fromX: number;
        fromY: number;
        delay: number;
        liftPx: number;
        arc: boolean;
      };
      settle: { node: PieceNode; targetPos: { x: number; y: number }; i: number };
    }>;

    await this.scheduler.enqueue({
      label: "move",
      tweens: tweens.flatMap(({ lift, settle }) => [
        {
          from: 0,
          to: 1,
          durationMs: PIECE_LIFT_DURATION_MS,
          delayMs: lift.delay,
          onUpdate: (t) => {
            lift.node.lift = t;
            lift.node.scale = 1 + (PICKUP_SCALE - 1) * t;
            lift.node.rotation = PICKUP_TILT_RAD * t;
            lift.node.dirty = true;
          },
        },
        {
          from: 0,
          to: 1,
          durationMs: PIECE_MOVE_DURATION_MS,
          delayMs: lift.delay + CARRIED_HORIZONTAL_DURATION_MS,
          onUpdate: (t) => {
            const arcH = lift.arc ? Math.sin(t * Math.PI) * this.pitch * 0.35 : 0;
            lift.node.root.x = lift.fromX + (settle.targetPos.x - lift.fromX) * t;
            lift.node.root.y =
              lift.fromY +
              (settle.targetPos.y - lift.fromY) * t -
              lift.liftPx * (1 - t) -
              arcH;
            lift.node.dirty = true;
          },
        },
      ]),
    });

    for (const id of ids) {
      const node = this.pieces.get(id);
      if (node) node.cell = target;
    }
    this.cells = this.hooks.getCells().map((c) => c.slice());

    await this.scheduler.enqueue({
      label: "settle",
      tweens: tweens.map(({ settle }) => ({
        from: 1.08,
        to: 1,
        durationMs: PLACE_SETTLE_DURATION_MS,
        delayMs: settle.i * SPREAD_STAGGER_MS,
        ease: "outBack" as const,
        onUpdate: (s) => {
          settle.node.scale = s;
          settle.node.rotation = 0;
          settle.node.lift = 0;
          settle.node.dirty = true;
        },
      })),
    });
    this.layoutDirty = true;
  }

  private spawnFromTray(sel: Selection): string[] {
    const ids: string[] = [];
    const side = sel.source.side;
    this.trays[side] = Math.max(0, this.trays[side] - sel.count);
    for (let i = 0; i < sel.count; i++) {
      const id = `p-${side}-${performance.now()}-${i}`;
      const meta: PieceInstance = {
        id,
        side,
        kind: { game: "tak", variant: "flat" },
      };
      this.pieceMeta.set(id, meta);
      this.mountPiece(meta, 0);
      const node = this.pieces.get(id)!;
      const trayX =
        side === "A"
          ? this.boardOrigin().x -
            (this.boardSize * this.pitch) / 2 -
            TRAY_THEME.gapFromBoardPitch * this.pitch
          : this.boardOrigin().x +
            (this.boardSize * this.pitch) / 2 +
            TRAY_THEME.gapFromBoardPitch * this.pitch;
      node.root.x = trayX;
      node.root.y = this.boardOrigin().y;
      ids.push(id);
    }
    return ids;
  }

  private redraw(): void {
    const w = this.boardSize * this.pitch;
    const { x: ox, y: oy } = this.boardOrigin();
    this.stageRoot.x = 0;
    this.stageRoot.y = 0;

    drawBoardShadow(this.boardShadow, w, w, this.theme);
    this.boardShadow.x = ox;
    this.boardShadow.y = oy + w / 2;

    this.boardGrid.clear();
    const lw = lineWidthPx(this.pitch);
    const slab = boardSlabPx(this.pitch);
    const left = ox - w / 2;
    const top = oy - w / 2;
    this.boardGrid.rect(left, top, w, w);
    this.boardGrid.fill(this.theme.boardFill);
    for (let i = 0; i <= this.boardSize; i++) {
      const o = i * this.pitch;
      this.boardGrid.rect(left + o - lw / 2, top, lw, w);
      this.boardGrid.fill(this.theme.boardLine);
      this.boardGrid.rect(left, top + o - lw / 2, w, lw);
      this.boardGrid.fill(this.theme.boardLine);
    }
    this.boardGrid.rect(left, top + w - slab, w, slab);
    this.boardGrid.fill(this.theme.boardSlabSide);

    this.drawTrays(ox, oy, w);
    this.applySelectionLift();
    this.drawHighlightsAndGhost();
    for (const node of this.pieces.values()) {
      if (node.dirty) {
        const meta = this.pieceMeta.get(node.id);
        if (meta) this.syncPieceTransform(node, meta);
        node.dirty = false;
      }
    }
  }

  private drawTrays(ox: number, oy: number, boardW: number): void {
    this.trayGfx.clear();
    const slotW = TRAY_THEME.slotPitch * this.pitch;
    const slotH = TRAY_THEME.slotDepthPitch * this.pitch;
    let li = 0;
    for (const side of ["A", "B"] as const) {
      const count = this.trays[side];
      const x =
        side === "A"
          ? ox - boardW / 2 - TRAY_THEME.gapFromBoardPitch * this.pitch - slotW
          : ox + boardW / 2 + TRAY_THEME.gapFromBoardPitch * this.pitch;
      this.trayGfx.rect(x, oy - slotH / 2, slotW, slotH);
      this.trayGfx.fill(this.theme.boardFill);
      this.trayGfx.stroke({ width: 1, color: this.theme.boardLine });
      let label = this.trayLabels[li];
      if (!label) {
        label = new Text({
          text: "",
          style: { fill: this.theme.boardLine, fontSize: TRAY_THEME.countFontSizePx },
        });
        this.trayLabels[li] = label;
        this.trayGfx.addChild(label);
      }
      label.text = String(count);
      label.x = x + slotW / 2 - label.width / 2;
      label.y = oy - slotH / 2 - 16;
      li++;
    }
  }

  private applySelectionLift(): void {
    const sel = this.view.selection;
    if (!sel || this.scheduler.busy) return;
    const ids = new Set(this.selectedIds(sel));
    for (const [id, node] of this.pieces) {
      const picked = ids.has(id);
      const targetLift = picked ? 1 : 0;
      if (Math.abs(node.lift - targetLift) > 0.01 && !picked) {
        node.lift = targetLift;
        node.dirty = true;
      } else if (picked && node.lift < 1) {
        node.lift = Math.min(1, node.lift + this.app.ticker.deltaMS / PIECE_LIFT_DURATION_MS);
        node.scale = 1 + (PICKUP_SCALE - 1) * node.lift;
        node.rotation = PICKUP_TILT_RAD * node.lift;
        node.dirty = true;
      }
    }
  }

  private drawHighlightsAndGhost(): void {
    this.highlightGfx.clear();
    this.ghostLayer.removeChildren();
    const sel = this.view.selection;
    if (!sel) return;
    const legal = this.hooks.legalTargets(sel);
    for (const idx of legal) {
      const c = this.cellCenter(idx);
      this.highlightGfx.rect(
        c.x - this.pitch / 2 + 2,
        c.y - this.pitch / 2 + 2,
        this.pitch - 4,
        this.pitch - 4,
      );
      this.highlightGfx.stroke({ width: 1, color: this.theme.hover, alpha: 0.85 });
    }
    const hover = this.view.hoverCell;
    if (hover !== null && legal.includes(hover)) {
      const ids = this.selectedIds(sel);
      const g = new Graphics();
      g.alpha = GHOST_ALPHA;
      const meta = this.pieceMeta.get(ids[0] ?? "") ?? {
        id: "ghost",
        side: "A" as const,
        kind: { game: "tak", variant: "flat" as const },
      };
      drawPiece(g, meta.kind, meta.side, this.pitch, this.theme);
      const c = this.cellCenter(hover);
      g.x = c.x;
      g.y = c.y;
      this.ghostLayer.addChild(g);
    }
  }

  destroy(): void {
    this.interaction?.dispose();
    this.app.destroy(true);
  }
}
