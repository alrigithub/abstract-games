import { Application, Container } from "pixi.js";
import {
  AnimatedBackground,
  applyCameraToContainer,
  fitCamera,
  screenToWorld,
} from "@shared";
import type { GameController } from "./game-controller";
import { CELL } from "./coords";
import {
  createTakBoardLayer,
  type BoardView,
} from "./tak-board";
import type { PlaceSelection } from "./place-selection";

export class TakScene {
  readonly app: Application;
  private bg: AnimatedBackground;
  private world = new Container();
  private boardLayer: ReturnType<typeof createTakBoardLayer> | null = null;
  private camera = { x: 0, y: 0, zoom: 1 };
  private linePhase = 0;
  private controller: GameController;
  private statusEl: HTMLElement;
  private view!: BoardView;

  constructor(
    _mount: HTMLElement,
    controller: GameController,
    statusEl: HTMLElement,
  ) {
    this.controller = controller;
    this.statusEl = statusEl;
    this.app = new Application();
    this.bg = new AnimatedBackground();
    this.view = {
      game: controller.getGame(),
      interactive: false,
      selection: null,
      hoverCell: null,
      selectedStack: null,
      linePhase: 0,
      roadLinger: 0,
    };
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

    const size = this.controller.getGame().board.size;
    const span = CELL * size;
    this.camera = fitCamera(
      { width: span * 1.6, height: span * 1.2 },
      { width: this.app.screen.width, height: this.app.screen.height },
      0.85,
    );

    this.boardLayer = createTakBoardLayer(this.world, {
      onPlayMove: (move) => this.controller.playHumanMove(move),
      getView: () => this.view,
      setSelection: (s) => this.controller.setSelection(s),
      setHoverCell: (c) => {
        this.view = { ...this.view, hoverCell: c };
      },
      setSelectedStack: (c) => this.controller.setSelectedStack(c),
    });

    this.setupInput();

    this.app.ticker.add((t) => {
      this.linePhase += t.deltaMS;
      this.bg.update(t.deltaMS, this.app.screen.width, this.app.screen.height);
      applyCameraToContainer(this.world, this.camera, {
        width: this.app.screen.width,
        height: this.app.screen.height,
      });
      this.view = {
        ...this.view,
        linePhase: this.linePhase,
      };
      this.boardLayer?.redraw();
    });
  }

  handleUpdate(ev: {
    game: ReturnType<GameController["getGame"]>;
    status: string;
    interactive: boolean;
    selection: PlaceSelection | null;
    selectedStack: number | null;
    aiThinking: boolean;
    roadLingerMs: number;
  }) {
    this.statusEl.textContent = ev.status;
    this.view = {
      game: ev.game,
      interactive: ev.interactive,
      selection: ev.selection,
      hoverCell: this.view.hoverCell,
      selectedStack: ev.selectedStack,
      linePhase: this.linePhase,
      roadLinger: ev.roadLingerMs,
    };
    this.boardLayer?.redraw();
  }

  private setupInput() {
    const canvas = this.app.canvas;
    let dragging = false;
    let dragStart = { x: 0, y: 0, cx: 0, cy: 0 };

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const before = screenToWorld(this.camera, sx, sy, {
          width: this.app.screen.width,
          height: this.app.screen.height,
        });
        if (e.ctrlKey) {
          const delta = e.deltaY > 0 ? 0.92 : 1.08;
          this.camera.zoom = Math.min(2.5, Math.max(0.45, this.camera.zoom * delta));
        } else {
          this.camera.x -= e.deltaX / this.camera.zoom;
          this.camera.y -= e.deltaY / this.camera.zoom;
        }
        const after = screenToWorld(this.camera, sx, sy, {
          width: this.app.screen.width,
          height: this.app.screen.height,
        });
        this.camera.x += before.x - after.x;
        this.camera.y += before.y - after.y;
      },
      { passive: false },
    );

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 1 || e.buttons === 4 || e.shiftKey) {
        dragging = true;
        dragStart = {
          x: e.clientX,
          y: e.clientY,
          cx: this.camera.x,
          cy: this.camera.y,
        };
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      this.camera.x =
        dragStart.cx - (e.clientX - dragStart.x) / this.camera.zoom;
      this.camera.y =
        dragStart.cy - (e.clientY - dragStart.y) / this.camera.zoom;
    });
    canvas.addEventListener("pointerup", () => {
      dragging = false;
    });
  }
}
