import { PixiWorkerAiBridge } from "@abstract/pixi-shared";
import { createGame, placePiece } from "./engine/place";
import type { BoopGameState, PieceKind } from "./engine/types";

export type BoopListener = (ev: {
  state: BoopGameState;
  status: string;
  aiThinking: boolean;
}) => void;

function cloneState(s: BoopGameState): BoopGameState {
  return JSON.parse(JSON.stringify(s)) as BoopGameState;
}

function normalizeKind(state: BoopGameState, kind: PieceKind): PieceKind {
  if (state.status.kind !== "playing") return kind;
  const pool = state.pools[state.status.toMove];
  if (kind === "kitten" && pool.kittens <= 0 && pool.cats > 0) return "cat";
  if (kind === "cat" && pool.cats <= 0 && pool.kittens > 0) return "kitten";
  return kind;
}

export class BoopGameController {
  private state: BoopGameState = createGame();
  private listener: BoopListener | null = null;
  private aiThinking = false;
  private selectedKind: PieceKind = "kitten";
  private gameId = 0;
  private aiBridge: PixiWorkerAiBridge;

  constructor() {
    this.aiBridge = new PixiWorkerAiBridge(
      new URL("./ai-worker.ts", import.meta.url),
    );
  }

  onUpdate(fn: BoopListener) {
    this.listener = fn;
  }

  getState(): BoopGameState {
    return cloneState(this.state);
  }

  getSelectedKind(): PieceKind {
    return this.selectedKind;
  }

  setSelectedKind(kind: PieceKind) {
    this.selectedKind = kind;
    this.emit();
  }

  isBusy(): boolean {
    return this.aiThinking;
  }

  async start() {
    this.state = createGame();
    this.gameId += 1;
    this.aiThinking = false;
    this.emit("Place a kitten or cat");
  }

  newGame() {
    void this.start();
  }

  async placeAt(row: number, col: number) {
    if (this.aiThinking) return;
    if (this.state.status.kind !== "playing") return;
    if (this.state.status.toMove !== "black") return;

    const kind = normalizeKind(this.state, this.selectedKind);
    const next = placePiece(this.state, row, col, kind);
    if (next === this.state) return;

    this.state = next;
    this.emit(statusFor(this.state, false));

    if (
      this.state.status.kind === "playing" &&
      this.state.status.toMove === "white"
    ) {
      await this.queueAi();
    }
  }

  private async queueAi() {
    if (this.state.status.kind !== "playing") return;
    if (this.aiBridge.thinking) return;

    this.aiThinking = true;
    this.emit("White is thinking…");
    const snapshot = cloneState(this.state);
    const gameId = this.gameId;

    try {
      const { moveJson, error } = await this.aiBridge.requestMove(
        JSON.stringify(snapshot),
        1,
      );
      this.aiThinking = false;
      if (gameId !== this.gameId) return;
      if (error) {
        this.emit("AI error: " + error);
        return;
      }
      if (!moveJson) return;
      const move = JSON.parse(moveJson) as {
        row: number;
        col: number;
        kind: PieceKind;
      };
      const aiNext = placePiece(this.state, move.row, move.col, move.kind);
      if (aiNext !== this.state) {
        this.state = aiNext;
      }
      this.emit(statusFor(this.state, false));
    } catch {
      this.aiThinking = false;
    }
  }

  private emit(status?: string) {
    this.listener?.({
      state: cloneState(this.state),
      status: status ?? statusFor(this.state, this.aiThinking),
      aiThinking: this.aiThinking,
    });
  }
}

function statusFor(state: BoopGameState, aiThinking: boolean): string {
  if (state.status.kind === "won") {
    return state.status.winner === "black" ? "You win!" : "White wins!";
  }
  if (aiThinking) return "White is thinking…";
  return state.status.toMove === "black" ? "Your turn" : "White to move";
}
