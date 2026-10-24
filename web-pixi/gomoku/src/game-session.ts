import { createAiWorkerBridge, theme } from "@abstract/pixi-shared";
import {
  createEmptyBoard,
  createInitialStatus,
  findWinningLine,
  place,
  type Board,
  type Coord,
  type GameStatus,
  winsAt,
} from "./engine";

export type SessionListener = (ev: {
  board: Board;
  status: GameStatus;
  lastMove: Coord | null;
  winLine: Coord[] | null;
  statusText: string;
  aiThinking: boolean;
}) => void;

type AiWorkerIn = { id: number; board: Board; gameId: number };
export class GomokuSession {
  private board: Board = createEmptyBoard();
  private status: GameStatus = createInitialStatus();
  private lastMove: Coord | null = null;
  private winLine: Coord[] | null = null;
  private aiThinking = false;
  private listener: SessionListener | null = null;
  private gameId = 0;
  private aiBridge = createAiWorkerBridge(
    new URL("./ai-worker.ts", import.meta.url),
  );
  private aiReqId = 0;
  private pendingAiId: number | null = null;

  constructor() {
    this.aiBridge.setHandler(({ id, moveJson, error }) => {
      if (this.pendingAiId !== id) return;
      this.pendingAiId = null;
      this.aiThinking = false;
      if (error) {
        this.emit(`AI error: ${error}`);
        return;
      }
      const move = JSON.parse(moveJson) as Coord;
      this.applyPlace(move.x, move.y, false);
    });
  }

  onUpdate(fn: SessionListener) {
    this.listener = fn;
  }

  start() {
    this.newGame();
  }

  newGame() {
    this.gameId += 1;
    this.board = createEmptyBoard();
    this.status = createInitialStatus();
    this.lastMove = null;
    this.winLine = null;
    this.aiThinking = false;
    this.pendingAiId = null;
    this.emit("Place a stone — you play Black");
  }

  placeAt(x: number, y: number) {
    if (this.aiThinking) return;
    if (this.status.kind !== "playing") return;
    if (this.status.toMove !== "black") return;
    this.applyPlace(x, y, true);
  }

  private applyPlace(x: number, y: number, fromHuman: boolean) {
    const result = place(this.board, this.status, x, y);
    if (result.board === this.board) return;

    this.board = result.board;
    this.status = result.status;
    this.lastMove = { x, y };

    if (result.status.kind === "won") {
      this.winLine = findWinningLine(
        this.board,
        x,
        y,
        result.status.winner,
      );
      window.setTimeout(() => {
        this.winLine = null;
        this.emit();
      }, theme.scoreLingerMs);
    }

    this.emit(this.statusText(fromHuman));

    if (this.status.kind === "playing" && this.status.toMove === "white") {
      this.queueAi();
    }
  }

  private queueAi() {
    if (this.aiThinking || this.status.kind !== "playing") return;
    this.aiThinking = true;
    this.emit("AI is thinking…");
    const id = ++this.aiReqId;
    this.pendingAiId = id;
    const payload: AiWorkerIn = {
      id,
      board: this.board.map((r) => r.slice()),
      gameId: this.gameId,
    };
    this.aiBridge.post({
      id,
      stateJson: JSON.stringify(payload),
      depth: 0,
    });
  }

  private statusText(fromHuman: boolean): string {
    if (this.status.kind === "won") {
      return this.status.winner === "black" ? "You win!" : "AI wins!";
    }
    if (this.status.kind === "draw") return "Draw";
    if (this.aiThinking) return "AI is thinking…";
    if (!fromHuman && this.status.toMove === "black") return "Your turn";
    return "Place a stone";
  }

  private emit(statusText?: string) {
    this.listener?.({
      board: this.board.map((r) => r.slice()),
      status: this.status,
      lastMove: this.lastMove,
      winLine: this.winLine,
      statusText: statusText ?? this.statusText(true),
      aiThinking: this.aiThinking,
    });
  }
}

export function computeWinLine(board: Board): Coord[] | null {
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < (board[y]?.length ?? 0); x++) {
      const p = board[y][x] as Player | null;
      if (p && winsAt(board, x, y, p)) {
        return findWinningLine(board, x, y, p);
      }
    }
  }
  return null;
}
