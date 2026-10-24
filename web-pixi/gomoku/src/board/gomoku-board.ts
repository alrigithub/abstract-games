import { Container, FederatedPointerEvent, Graphics } from "pixi.js";
import { PIXI_PALETTE } from "@abstract/pixi-shared";
import type { Board, Coord, Player } from "../engine";
import { BOARD_SIZE } from "../engine";
import { CELL, intersectionToWorld, worldToIntersection } from "./coords";

const STONE_R = CELL * 0.42;
const PAD = CELL * 0.6;
const SPAN = CELL * (BOARD_SIZE - 1);

export type GomokuBoardProps = {
  board: Board;
  toMove: Player | null;
  interactive: boolean;
  winLine: Coord[] | null;
  lastMove: Coord | null;
};

export function createGomokuBoardLayer(
  world: Container,
  opts: {
    onPlace: (x: number, y: number) => void;
  },
) {
  const root = new Container();
  world.addChild(root);

  const boardGfx = new Graphics();
  const stonesGfx = new Graphics();
  const lastMoveGfx = new Graphics();
  const winGfx = new Graphics();
  const hoverGfx = new Graphics();
  root.addChild(boardGfx, winGfx, stonesGfx, lastMoveGfx, hoverGfx);

  let hover: { x: number; y: number } | null = null;
  let props: GomokuBoardProps = {
    board: [],
    toMove: null,
    interactive: false,
    winLine: null,
    lastMove: null,
  };

  const hit = new Graphics();
  hit.rect(-SPAN / 2 - PAD, -SPAN / 2 - PAD, SPAN + PAD * 2, SPAN + PAD * 2);
  hit.fill({ color: 0xffffff, alpha: 0.001 });
  hit.eventMode = "static";
  hit.cursor = "pointer";
  root.addChild(hit);

  function drawBoard() {
    boardGfx.clear();
    const half = SPAN / 2;
    boardGfx
      .roundRect(-half - PAD * 0.5, -half - PAD * 0.5, SPAN + PAD, SPAN + PAD, 8)
      .fill(PIXI_PALETTE.boardFill);
    for (let i = 0; i < BOARD_SIZE; i++) {
      const { x: wx, y: wy0 } = intersectionToWorld(i, 0);
      const { y: wy1 } = intersectionToWorld(i, BOARD_SIZE - 1);
      boardGfx.moveTo(wx, wy0);
      boardGfx.lineTo(wx, wy1);
      const { x: wx0, y: wy } = intersectionToWorld(0, i);
      const { x: wx1 } = intersectionToWorld(BOARD_SIZE - 1, i);
      boardGfx.moveTo(wx0, wy);
      boardGfx.lineTo(wx1, wy);
    }
    boardGfx.stroke({ width: 1.5, color: PIXI_PALETTE.boardLine });
  }

  function drawStone(
    g: Graphics,
    wx: number,
    wy: number,
    player: Player,
    alpha = 1,
  ) {
    if (player === "black") {
      g.circle(wx, wy, STONE_R);
      g.fill({ color: PIXI_PALETTE.playerA, alpha });
    } else {
      g.circle(wx, wy, STONE_R);
      g.fill({ color: PIXI_PALETTE.playerB, alpha });
      g.circle(wx, wy, STONE_R);
      g.stroke({ width: 2, color: PIXI_PALETTE.playerBStroke, alpha });
    }
  }

  function redraw() {
    stonesGfx.clear();
    winGfx.clear();
    lastMoveGfx.clear();
    hoverGfx.clear();

    const winSet = new Set((props.winLine ?? []).map((c) => `${c.x},${c.y}`));

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = props.board[y]?.[x];
        if (!cell) continue;
        const { x: wx, y: wy } = intersectionToWorld(x, y);
        if (winSet.has(`${x},${y}`)) {
          winGfx.circle(wx, wy, STONE_R + 4);
          winGfx.fill({ color: PIXI_PALETTE.win, alpha: 0.35 });
        }
        drawStone(stonesGfx, wx, wy, cell);
      }
    }

    if (props.lastMove) {
      const { x: wx, y: wy } = intersectionToWorld(
        props.lastMove.x,
        props.lastMove.y,
      );
      lastMoveGfx.circle(wx, wy, 5);
      lastMoveGfx.fill({ color: PIXI_PALETTE.win, alpha: 0.9 });
    }

    if (
      props.interactive &&
      props.toMove &&
      hover &&
      props.board[hover.y]?.[hover.x] === null
    ) {
      const { x: wx, y: wy } = intersectionToWorld(hover.x, hover.y);
      drawStone(hoverGfx, wx, wy, props.toMove, 0.35);
    }
  }

  function onMove(e: FederatedPointerEvent) {
    const local = root.toLocal(e.global);
    hover = worldToIntersection(local.x, local.y);
    redraw();
  }

  hit.on("pointermove", onMove);
  hit.on("pointerleave", () => {
    hover = null;
    redraw();
  });
  hit.on("pointertap", (e: FederatedPointerEvent) => {
    if (!props.interactive) return;
    const local = root.toLocal(e.global);
    const cell = worldToIntersection(local.x, local.y);
    if (!cell) return;
    if (props.board[cell.y]?.[cell.x] !== null) return;
    opts.onPlace(cell.x, cell.y);
  });

  drawBoard();
  redraw();

  return {
    update(next: GomokuBoardProps) {
      props = next;
      hit.eventMode = next.interactive ? "static" : "passive";
      redraw();
    },
    destroy() {
      hit.removeAllListeners();
      root.destroy({ children: true });
    },
  };
}
