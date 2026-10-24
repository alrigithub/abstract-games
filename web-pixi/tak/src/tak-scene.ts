import {
  AnimatedBackground,
  applyCameraToContainer,
  fitCamera,
  type PixiStageApi,
} from "@abstract/pixi-shared";
import type { GameController } from "./game-controller";
import { CELL } from "./coords";
import {
  createTakBoardLayer,
  type BoardView,
} from "./tak-board";
import type { PlaceSelection } from "./place-selection";

export class TakScene {
  private bg: AnimatedBackground;
  private boardLayer: ReturnType<typeof createTakBoardLayer> | null = null;
  private linePhase = 0;
  private controller: GameController;
  private statusEl: HTMLElement;
  private view!: BoardView;

  constructor(
    private stage: PixiStageApi,
    controller: GameController,
    statusEl: HTMLElement,
  ) {
    this.controller = controller;
    this.statusEl = statusEl;
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

  init() {
    this.stage.app.stage.addChildAt(this.bg, 0);

    const size = this.controller.getGame().board.size;
    const span = CELL * size;
    this.stage.setCamera(
      fitCamera(
        { width: span * 1.6, height: span * 1.2 },
        {
          width: this.stage.app.screen.width,
          height: this.stage.app.screen.height,
        },
        0.85,
      ),
    );

    this.boardLayer = createTakBoardLayer(this.stage.world, {
      onPlayMove: (move) => this.controller.playHumanMove(move),
      getView: () => this.view,
      setSelection: (s) => this.controller.setSelection(s),
      setHoverCell: (c) => {
        this.view = { ...this.view, hoverCell: c };
      },
      setSelectedStack: (c) => this.controller.setSelectedStack(c),
    });

    this.stage.app.ticker.add((t) => {
      this.linePhase += t.deltaMS;
      this.bg.update(
        t.deltaMS,
        this.stage.app.screen.width,
        this.stage.app.screen.height,
      );
      applyCameraToContainer(this.stage.world, this.stage.getCamera(), {
        width: this.stage.app.screen.width,
        height: this.stage.app.screen.height,
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
}
