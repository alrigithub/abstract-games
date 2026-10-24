import { Container, FederatedPointerEvent, Graphics, Text } from "pixi.js";
import { palette, theme } from "@abstract/pixi-shared";
import {
  placementColor,
  reservePieces,
  step,
  type GameState,
  type Move,
} from "./engine";
import type { Color, Piece, PieceKind } from "./types";
import { CELL, cellCenter, cellToIndex, worldToCell } from "./coords";
import { roadCells } from "./road-cells";
import type { PlaceSelection } from "./place-selection";
import { slideTo, spreadPreviewCells } from "./slide";

const FLAT_H = 10;
const WALL_H = 22;
const CAP_R = 14;

function colorFill(color: Color): { fill: number; stroke?: number } {
  return color === "charcoal"
    ? { fill: palette.playerA }
    : { fill: palette.playerB, stroke: palette.playerBStroke };
}

function drawPiece(
  g: Graphics,
  piece: Piece,
  cx: number,
  cy: number,
  selected: boolean,
) {
  const { fill, stroke } = colorFill(piece.color);
  if (piece.kind === "capstone") {
    g.circle(cx, cy, CAP_R * 0.55);
    g.fill({ color: fill });
    if (stroke) g.stroke({ width: 2, color: stroke });
  } else if (piece.orientation === "standing") {
    g.roundRect(cx - 10, cy - WALL_H / 2, 20, WALL_H, 3);
    g.fill({ color: fill });
    if (stroke) g.stroke({ width: 2, color: stroke });
  } else {
    g.roundRect(cx - 14, cy - FLAT_H / 2, 28, FLAT_H, 4);
    g.fill({ color: fill });
    if (stroke) g.stroke({ width: 2, color: stroke });
  }
  if (selected) {
    g.roundRect(cx - 18, cy - 16, 36, 32, 5);
    g.stroke({ width: 2.5, color: palette.selectionGlow, alpha: 0.95 });
    g.roundRect(cx - 18, cy - 16, 36, 32, 5);
    g.stroke({ width: 1, color: palette.hover, alpha: 0.55 });
  }
}

function reservePosition(
  size: number,
  color: Color,
  kind: PieceKind,
  index: number,
): { x: number; y: number } {
  const side = color === "ivory" ? -1 : 1;
  const boardHalf = ((size - 1) / 2) * CELL + CELL;
  const row = index % 4;
  const col = Math.floor(index / 4);
  return {
    x: side * (boardHalf + 40 + col * 36),
    y: (row - 1.5) * 36,
  };
}

export type BoardView = {
  game: GameState;
  interactive: boolean;
  selection: PlaceSelection | null;
  hoverCell: number | null;
  selectedStack: number | null;
  linePhase: number;
  roadLinger: number;
};

export function createTakBoardLayer(
  world: Container,
  opts: {
    onPlayMove: (move: Move) => void;
    getView: () => BoardView;
    setSelection: (s: PlaceSelection | null) => void;
    setHoverCell: (c: number | null) => void;
    setSelectedStack: (c: number | null) => void;
  },
) {
  const root = new Container();
  world.addChild(root);

  const boardGfx = new Graphics();
  const roadGfx = new Graphics();
  const previewGfx = new Graphics();
  const piecesGfx = new Graphics();
  const reserveGfx = new Graphics();
  const hoverGfx = new Graphics();
  const labelLayer = new Container();
  root.addChild(
    boardGfx,
    roadGfx,
    previewGfx,
    piecesGfx,
    hoverGfx,
    labelLayer,
    reserveGfx,
  );

  const hit = new Graphics();
  hit.eventMode = "static";
  root.addChild(hit);

  function drawGrid(size: number, linePhase: number) {
    boardGfx.clear();
    const pulse = 0.55 + 0.45 * Math.sin(linePhase * 0.002);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const { x, y } = cellCenter(col, row, size);
        boardGfx.roundRect(x - CELL / 2 + 1, y - CELL / 2 + 1, CELL - 2, CELL - 2, 4);
        boardGfx.fill(palette.boardFill);
        boardGfx.stroke({
          width: 1,
          color: palette.boardLine,
          alpha: 0.35 + 0.65 * pulse,
        });
      }
    }
  }

  function redraw() {
    const view = opts.getView();
    const {
      game,
      interactive,
      selection,
      hoverCell,
      selectedStack,
      linePhase,
      roadLinger,
    } = view;
    const size = game.board.size;
    drawGrid(size, linePhase);

    roadGfx.clear();
    if (game.result?.reason === "road" && game.result.winner) {
      const cells = roadCells(game.board, game.result.winner);
      const alpha =
        roadLinger > 0
          ? 0.35 + 0.45 * (roadLinger / theme.scoreLingerMs)
          : 0.35;
      for (const idx of cells) {
        const col = idx % size;
        const row = Math.floor(idx / size);
        const { x, y } = cellCenter(col, row, size);
        roadGfx.roundRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 4);
        roadGfx.fill({ color: palette.win, alpha });
        roadGfx.roundRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 4);
        roadGfx.stroke({ width: 2, color: palette.win, alpha: alpha * 0.9 });
      }
    }

    previewGfx.clear();
    if (interactive && selectedStack !== null && hoverCell !== null) {
      const move = slideTo(game, selectedStack, hoverCell);
      if (move?.type === "spread") {
        const path = spreadPreviewCells(
          move.from,
          move.direction,
          move.drops,
          size,
        );
        let dropIdx = 0;
        let remaining = move.drops[dropIdx] ?? 0;
        for (const cell of path) {
          const col = cell % size;
          const row = Math.floor(cell / size);
          const { x, y } = cellCenter(col, row, size);
          previewGfx.roundRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4, 3);
          previewGfx.stroke({ width: 2, color: palette.hover, alpha: 0.75 });
          if (remaining > 0) {
            previewGfx.circle(x, y - 8, 8);
            previewGfx.fill({ color: palette.win, alpha: 0.85 });
          }
          remaining -= 1;
          if (remaining <= 0) {
            dropIdx += 1;
            remaining = move.drops[dropIdx] ?? 0;
          }
        }
      }
    }

    piecesGfx.clear();
    reserveGfx.clear();
    hoverGfx.clear();
    labelLayer.removeChildren();

    for (let idx = 0; idx < size * size; idx++) {
      const stack = game.board.cells[idx] ?? [];
      const col = idx % size;
      const row = Math.floor(idx / size);
      const { x, y: baseY } = cellCenter(col, row, size);
      let offset = 0;
      const stackSelected = interactive && selectedStack === idx;
      stack.forEach((piece, i) => {
        const cy = baseY - offset;
        const isTop = i === stack.length - 1;
        drawPiece(
          piecesGfx,
          piece,
          x,
          cy,
          stackSelected && isTop,
        );
        offset +=
          piece.orientation === "standing" ? WALL_H * 0.6 : FLAT_H * 0.55;
      });
      if (stack.length > 1) {
        const label = new Text({
          text: String(stack.length),
          style: {
            fill: palette.boardLine,
            fontSize: 11,
            fontFamily: "system-ui, sans-serif",
            fontWeight: "600",
          },
        });
        label.anchor.set(1, 0);
        label.position.set(x + CELL / 2 - 4, baseY - CELL / 2 + 2);
        labelLayer.addChild(label);
      }
      if (stackSelected) {
        hoverGfx.roundRect(
          x - CELL / 2,
          baseY - CELL / 2,
          CELL,
          CELL,
          4,
        );
        hoverGfx.stroke({ width: 2, color: palette.selectionGlow, alpha: 0.9 });
      }
    }

    const active = placementColor(game);
    if (interactive && selection && hoverCell !== null && game.ply >= 2) {
      const stack = game.board.cells[hoverCell];
      if (!stack?.length) {
        const col = hoverCell % size;
        const row = Math.floor(hoverCell / size);
        const { x, y } = cellCenter(col, row, size);
        hoverGfx.roundRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 4);
        hoverGfx.stroke({ width: 2, color: palette.hover, alpha: 0.8 });
        const ghost: Piece = {
          id: "ghost",
          color: game.toMove,
          kind: selection.kind,
          orientation:
            selection.kind === "capstone" ? "flat" : selection.orientation,
        };
        drawPiece(hoverGfx, ghost, x, y, false);
      }
    } else if (interactive && selection && hoverCell !== null && game.ply < 2) {
      const stack = game.board.cells[hoverCell];
      if (!stack?.length) {
        const col = hoverCell % size;
        const row = Math.floor(hoverCell / size);
        const { x, y } = cellCenter(col, row, size);
        hoverGfx.roundRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 4);
        hoverGfx.stroke({ width: 2, color: palette.hover, alpha: 0.8 });
        const ghost: Piece = {
          id: "ghost",
          color: active,
          kind: "stone",
          orientation: "flat",
        };
        drawPiece(hoverGfx, ghost, x, y, false);
      }
    }

    if (interactive) {
      for (const color of ["ivory", "charcoal"] as const) {
        for (const kind of ["stone", "capstone"] as const) {
          if (game.ply < 2) continue;
          if (color !== game.toMove) continue;
          const pieces = reservePieces(game, color, kind);
          pieces.forEach((piece, i) => {
            const pos = reservePosition(size, color, kind, i);
            const sel =
              selection &&
              selection.kind === kind &&
              (kind === "capstone" ||
                selection.orientation === piece.orientation);
            drawPiece(reserveGfx, piece, pos.x, pos.y, !!sel);
          });
        }
      }
    }

    hit.clear();
    const span = size * CELL;
    hit.rect(-span * 1.2, -span * 1.2, span * 2.4, span * 2.4);
    hit.fill({ color: 0xffffff, alpha: 0.001 });
  }

  function tryReserveHit(wx: number, wy: number): boolean {
    const view = opts.getView();
    const { game, interactive, selection } = view;
    if (!interactive || game.ply < 2) return false;
    const size = game.board.size;
    const active = game.toMove;
    for (const kind of ["stone", "capstone"] as const) {
      const pieces = reservePieces(game, active, kind);
      for (let i = 0; i < pieces.length; i++) {
        const pos = reservePosition(size, active, kind, i);
        if (Math.hypot(wx - pos.x, wy - pos.y) < 22) {
          const piece = pieces[i]!;
          if (kind === "capstone") {
            opts.setSelection({ kind: "capstone", orientation: "flat" });
          } else {
            const cur = selection;
            if (cur?.kind === "stone" && cur.orientation === piece.orientation) {
              opts.setSelection({
                kind: "stone",
                orientation:
                  piece.orientation === "flat" ? "standing" : "flat",
              });
            } else {
              opts.setSelection({
                kind: "stone",
                orientation: piece.orientation,
              });
            }
          }
          opts.setSelectedStack(null);
          return true;
        }
      }
    }
    return false;
  }

  hit.on("pointermove", (e: FederatedPointerEvent) => {
    const local = root.toLocal(e.global);
    const cell = worldToCell(local.x, local.y, opts.getView().game.board.size);
    opts.setHoverCell(
      cell ? cellToIndex(cell.col, cell.row, opts.getView().game.board.size) : null,
    );
    redraw();
  });

  hit.on("pointerleave", () => {
    opts.setHoverCell(null);
    redraw();
  });

  hit.on("pointertap", (e: FederatedPointerEvent) => {
    const view = opts.getView();
    if (!view.interactive) return;
    const local = root.toLocal(e.global);
    if (tryReserveHit(local.x, local.y)) {
      redraw();
      return;
    }

    const game = view.game;
    const size = game.board.size;
    const cell = worldToCell(local.x, local.y, size);
    if (!cell) return;
    const index = cellToIndex(cell.col, cell.row, size);

    if (game.ply >= 2) {
      const top = game.board.cells[index]?.at(-1);
      if (view.selectedStack !== null) {
        if (view.selectedStack === index) {
          opts.setSelectedStack(null);
          redraw();
          return;
        }
        const move = slideTo(game, view.selectedStack, index);
        if (move) {
          opts.onPlayMove(move);
          opts.setSelectedStack(null);
          return;
        }
      }
      if (top?.color === game.toMove) {
        opts.setSelectedStack(index);
        opts.setSelection(null);
        redraw();
        return;
      }
      const selection = view.selection;
      if (selection && !game.board.cells[index]?.length) {
        opts.onPlayMove({
          type: "place",
          to: index,
          kind: selection.kind,
          orientation:
            selection.kind === "capstone" ? "flat" : selection.orientation,
        });
        return;
      }
      return;
    }

    const selection = view.selection ?? { kind: "stone", orientation: "flat" };
    if (game.board.cells[index]?.length) return;
    opts.onPlayMove({
      type: "place",
      to: index,
      kind: "stone",
      orientation: "flat",
    });
  });

  redraw();

  return {
    redraw,
    destroy() {
      hit.removeAllListeners();
      root.destroy({ children: true });
    },
  };
}

/** Neighbor cells reachable by a legal slide from `from`. */
export function slideNeighborHints(
  game: GameState,
  from: number,
): number[] {
  const size = game.board.size;
  const out = new Set<number>();
  for (const direction of ["north", "east", "south", "west"] as const) {
    const next = step(size, from, direction);
    if (next !== null && slideTo(game, from, next)) out.add(next);
  }
  return [...out];
}
