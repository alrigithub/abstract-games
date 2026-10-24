import { Container, FederatedPointerEvent, Graphics } from "pixi.js";
import type { BoopGameState, Piece, PieceKind, Player } from "../engine/types";
import { BED_SIZE } from "../engine/types";
import { PIXI_PALETTE } from "@abstract/pixi-shared";
import { CELL, cellCenter, worldToCell } from "./coords";

const KITTEN_R = 10;
const CAT_R = 14;

function drawPiece(
  g: Graphics,
  piece: Piece,
  x: number,
  y: number,
  alpha = 1,
) {
  const r = piece.kind === "kitten" ? KITTEN_R : CAT_R;
  if (piece.owner === "black") {
    g.circle(x, y, r);
    g.fill({ color: PIXI_PALETTE.playerA, alpha });
  } else {
    g.circle(x, y, r);
    g.fill({ color: PIXI_PALETTE.playerB, alpha });
    g.circle(x, y, r);
    g.stroke({ width: 2, color: PIXI_PALETTE.playerBStroke, alpha });
  }
}

function drawGhost(
  g: Graphics,
  owner: Player,
  kind: PieceKind,
  x: number,
  y: number,
) {
  drawPiece(g, { owner, kind }, x, y, 0.38);
}

export function createBoopBoardLayer(
  world: Container,
  opts: { onPlace: (row: number, col: number) => void },
) {
  const root = new Container();
  world.addChild(root);

  const bedGfx = new Graphics();
  const gradGfx = new Graphics();
  const winGfx = new Graphics();
  const ghostGfx = new Graphics();
  const piecesGfx = new Graphics();
  root.addChild(bedGfx, gradGfx, winGfx, piecesGfx, ghostGfx);

  let props: {
    state: BoopGameState;
    interactive: boolean;
    selectedKind: PieceKind;
  } = {
    state: {
      bed: [],
      pools: {
        black: { kittens: 0, cats: 0, reserveCats: 0 },
        white: { kittens: 0, cats: 0, reserveCats: 0 },
      },
      status: { kind: "playing", toMove: "black" },
      lastBoops: [],
    },
    interactive: false,
    selectedKind: "kitten",
  };

  let prevBedJson = "";
  let gradTimer = 0;

  const animOffset = new Map<string, { dx: number; dy: number; t: number }>();

  const hit = new Graphics();
  hit.eventMode = "static";
  root.addChild(hit);

  function key(r: number, c: number) {
    return `${r},${c}`;
  }

  function drawBed() {
    bedGfx.clear();
    for (let row = 0; row < BED_SIZE; row++) {
      for (let col = 0; col < BED_SIZE; col++) {
        const { x, y } = cellCenter(col, row);
        bedGfx.roundRect(
          x - CELL / 2 + 1,
          y - CELL / 2 + 1,
          CELL - 2,
          CELL - 2,
          6,
        );
        bedGfx.fill(PIXI_PALETTE.boardFill);
        bedGfx.stroke({ width: 1, color: PIXI_PALETTE.boardLine });
      }
    }
  }

  function redrawGradGlow(cells: Set<string>, alpha: number) {
    gradGfx.clear();
    if (alpha <= 0) return;
    for (const k of cells) {
      const [rs, cs] = k.split(",");
      const row = Number(rs);
      const col = Number(cs);
      const { x, y } = cellCenter(col, row);
      gradGfx.roundRect(
        x - CELL / 2 + 1,
        y - CELL / 2 + 1,
        CELL - 2,
        CELL - 2,
        6,
      );
      gradGfx.fill({ color: PIXI_PALETTE.graduation, alpha: 0.35 * alpha });
    }
  }

  function detectGraduatedCells(before: BoopGameState, after: BoopGameState) {
    const cleared = new Set<string>();
    for (let row = 0; row < BED_SIZE; row++) {
      for (let col = 0; col < BED_SIZE; col++) {
        if (before.bed[row]?.[col] && !after.bed[row]?.[col]) {
          cleared.add(key(row, col));
        }
      }
    }
    return cleared;
  }

  function redrawWinGlow() {
    winGfx.clear();
    const line = props.state.winningLine;
    if (!line?.length) return;
    const winSet = new Set(line.map(({ r, c }) => key(r, c)));
    for (let row = 0; row < BED_SIZE; row++) {
      for (let col = 0; col < BED_SIZE; col++) {
        if (!winSet.has(key(row, col))) continue;
        const { x, y } = cellCenter(col, row);
        winGfx.roundRect(
          x - CELL / 2 + 1,
          y - CELL / 2 + 1,
          CELL - 2,
          CELL - 2,
          6,
        );
        winGfx.fill({ color: PIXI_PALETTE.win, alpha: 0.45 });
      }
    }
  }

  function redrawGhost(cell: { row: number; col: number } | null) {
    ghostGfx.clear();
    if (!cell || !props.interactive) return;
    if (props.state.status.kind !== "playing") return;
    if (props.state.bed[cell.row]?.[cell.col]) return;
    const toMove = props.state.status.toMove;
    const { x, y } = cellCenter(cell.col, cell.row);
    drawGhost(ghostGfx, toMove, props.selectedKind, x, y);
  }

  function redrawPieces() {
    piecesGfx.clear();
    const { bed } = props.state;
    for (let row = 0; row < BED_SIZE; row++) {
      for (let col = 0; col < BED_SIZE; col++) {
        const piece = bed[row]?.[col];
        if (!piece) continue;
        const { x, y } = cellCenter(col, row);
        const off = animOffset.get(key(row, col));
        const dx = off ? off.dx * (1 - off.t) : 0;
        const dy = off ? off.dy * (1 - off.t) : 0;
        drawPiece(piecesGfx, piece, x + dx, y + dy);
      }
    }
  }

  function startBoops(state: BoopGameState) {
    animOffset.clear();
    for (const ev of state.lastBoops) {
      if (!ev.to) continue;
      const from = cellCenter(ev.from.c, ev.from.r);
      const to = cellCenter(ev.to.c, ev.to.r);
      animOffset.set(key(ev.to.r, ev.to.c), {
        dx: from.x - to.x,
        dy: from.y - to.y,
        t: 0,
      });
    }
  }

  let tickerFn: ((t: { deltaTime: number }) => void) | null = null;
  let gradCells = new Set<string>();

  function redraw() {
    drawBed();
    redrawWinGlow();
    redrawPieces();
    const span = BED_SIZE * CELL;
    hit.clear();
    hit.rect(-span, -span, span * 2, span * 2);
    hit.fill({ color: 0xffffff, alpha: 0.001 });
  }

  hit.on("pointertap", (e: FederatedPointerEvent) => {
    if (!props.interactive) return;
    const local = root.toLocal(e.global);
    const cell = worldToCell(local.x, local.y);
    if (!cell) return;
    opts.onPlace(cell.row, cell.col);
  });

  hit.on("pointermove", (e: FederatedPointerEvent) => {
    const local = root.toLocal(e.global);
    const cell = worldToCell(local.x, local.y);
    redrawGhost(cell);
  });

  hit.on("pointerleave", () => redrawGhost(null));

  redraw();

  return {
    update(
      next: typeof props,
      app?: {
        ticker: {
          add: (fn: (t: { deltaTime: number }) => void) => void;
          remove: (fn: (t: { deltaTime: number }) => void) => void;
        };
      },
    ) {
      const before = props.state;
      const boopsChanged = next.state.lastBoops !== props.state.lastBoops;
      const bedJson = JSON.stringify(next.state.bed);
      if (bedJson !== prevBedJson && prevBedJson) {
        const graduated = detectGraduatedCells(before, next.state);
        if (graduated.size >= 3) {
          gradCells = graduated;
          gradTimer = 1;
        }
      }
      prevBedJson = bedJson;
      props = next;
      hit.eventMode = next.interactive ? "static" : "passive";
      if (boopsChanged && next.state.lastBoops.length) {
        startBoops(next.state);
        if (app && !tickerFn) {
          tickerFn = () => {
            let any = false;
            for (const [k, v] of animOffset) {
              v.t = Math.min(1, v.t + 0.08);
              if (v.t < 1) any = true;
              else animOffset.delete(k);
            }
            if (gradTimer > 0) {
              gradTimer = Math.max(0, gradTimer - 0.04);
              redrawGradGlow(gradCells, gradTimer);
            }
            redrawWinGlow();
            redrawPieces();
            if (!any && gradTimer <= 0 && tickerFn && app) {
              app.ticker.remove(tickerFn);
              tickerFn = null;
            }
          };
          app.ticker.add(tickerFn);
        }
      }
      redraw();
    },
    destroy() {
      hit.removeAllListeners();
      root.destroy({ children: true });
    },
  };
}
