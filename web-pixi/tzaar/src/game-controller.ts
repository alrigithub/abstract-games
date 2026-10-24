import { AiWorkerClient, theme } from "@abstract/pixi-shared";
import type { Coord } from "./coords";
import type { MoveJson, Player, RenderState } from "./types";
import { wasmApplyMove, wasmNewGame } from "./wasm-api";

export type VisualEvent =
  | {
      kind: "action";
      from: Coord;
      to: Coord;
      capture: boolean;
    }
  | { kind: "pass" };

export type GameListener = (ev: {
  state: RenderState;
  status: string;
  visual: VisualEvent[];
  aiThinking: boolean;
  selected: Coord | null;
}) => void;

function cloneState(s: RenderState): RenderState {
  return JSON.parse(JSON.stringify(s)) as RenderState;
}

function isCaptureMove(
  before: RenderState,
  from: Coord,
  to: Coord,
): boolean {
  const target = before.board.stacks[to.y * 9 + to.x];
  if (!target?.pieces.length) return true;
  const mover = before.board.stacks[from.y * 9 + from.x];
  if (!mover?.pieces.length) return false;
  return target.pieces[0].player !== mover.pieces[0].player;
}

export class GameController {
  private state: RenderState | null = null;
  private listener: GameListener | null = null;
  private animating = false;
  private aiThinking = false;
  private aiDepth = 10;
  private aiWorker: AiWorkerClient;
  private selected: Coord | null = null;
  private winLinger = false;

  constructor() {
    this.aiWorker = new AiWorkerClient(
      new URL("./ai-worker.ts", import.meta.url),
    );
  }

  setAiDepth(depth: number) {
    this.aiDepth = depth;
  }

  onUpdate(fn: GameListener) {
    this.listener = fn;
  }

  async start() {
    this.state = await wasmNewGame();
    this.selected = null;
    this.notify(statusText(this.state));
    void this.afterStateSettled();
  }

  getState(): RenderState | null {
    return this.state ? cloneState(this.state) : null;
  }

  getSelected(): Coord | null {
    return this.selected;
  }

  isBusy(): boolean {
    return (
      this.animating ||
      this.aiThinking ||
      this.aiWorker.isBusy() ||
      this.winLinger
    );
  }

  async humanClick(coord: Coord) {
    if (!this.state || this.isBusy() || !this.state.human_turn) return;

    if (this.selected) {
      if (this.selected.x === coord.x && this.selected.y === coord.y) {
        this.selected = null;
        this.emit();
        return;
      }
      const move = findAction(this.state, this.selected, coord);
      if (move) {
        this.selected = null;
        await this.applyMove(move, true);
        return;
      }
    }

    if (stackOwnedBy(this.state, coord, "First")) {
      this.selected = coord;
      this.emit();
    }
  }

  async passSecond() {
    if (!this.state || this.isBusy() || !this.state.can_pass) return;
    await this.applyMove({ type: "passSecond" }, true);
  }

  private async applyMove(move: MoveJson, fromHuman: boolean) {
    if (!this.state) return;
    const before = cloneState(this.state);
    this.state = await wasmApplyMove(before, move);
    const visual: VisualEvent[] = [];
    if (move.type === "action") {
      visual.push({
        kind: "action",
        from: move.from,
        to: move.to,
        capture: isCaptureMove(before, move.from, move.to),
      });
    } else {
      visual.push({ kind: "pass" });
    }

    const hadWinner = !before.winner && this.state.winner;
    this.animating = visual.some((v) => v.kind === "action");
    const duration =
      visual.some((v) => v.kind === "action") ? theme.animMs : 0;

    if (hadWinner) {
      this.winLinger = true;
      setTimeout(() => {
        this.winLinger = false;
        void this.afterStateSettled();
      }, theme.scoreLingerMs);
    }

    if (duration > 0) {
      setTimeout(() => {
        this.animating = false;
        if (!this.winLinger) void this.afterStateSettled();
      }, duration);
    } else {
      this.animating = false;
      if (!this.winLinger) void this.afterStateSettled();
    }

    this.notify(
      fromHuman ? statusText(this.state) : statusText(this.state),
      visual,
    );
  }

  private async afterStateSettled() {
    if (!this.state || this.isBusy()) return;
    if (
      this.state.to_move === "Second" &&
      !this.state.winner &&
      !this.winLinger
    ) {
      await this.queueAi();
    }
  }

  private async queueAi() {
    if (!this.state || this.aiThinking) return;
    this.aiThinking = true;
    this.notify("Black is thinking…");
    this.emit();
    try {
      const resp = await this.aiWorker.requestMove(
        JSON.stringify(this.state),
        this.aiDepth,
      );
      this.aiThinking = false;
      if (resp.error) {
        this.notify("AI error: " + resp.error);
        return;
      }
      await this.applyMove(JSON.parse(resp.moveJson) as MoveJson, false);
    } catch {
      this.aiThinking = false;
    }
  }

  private notify(status: string, visual: VisualEvent[] = []) {
    if (!this.state) return;
    this.listener?.({
      state: cloneState(this.state),
      status,
      visual,
      aiThinking: this.aiThinking,
      selected: this.selected,
    });
  }

  private emit(visual: VisualEvent[] = []) {
    if (!this.state) return;
    this.listener?.({
      state: cloneState(this.state),
      status: statusText(this.state),
      visual,
      aiThinking: this.aiThinking,
      selected: this.selected,
    });
  }
}

function stackOwnedBy(
  state: RenderState,
  coord: Coord,
  player: Player,
): boolean {
  const cell = state.board.stacks[coord.y * 9 + coord.x];
  return cell?.pieces[0]?.player === player;
}

function findAction(
  state: RenderState,
  from: Coord,
  to: Coord,
): MoveJson | null {
  for (const m of state.legal_moves) {
    if (m.type !== "action") continue;
    if (m.from.x === from.x && m.from.y === from.y && m.to.x === to.x && m.to.y === to.y) {
      return m;
    }
  }
  return null;
}

function statusText(state: RenderState): string {
  if (state.winner) {
    return state.winner === "First" ? "You win!" : "Black wins!";
  }
  switch (state.phase) {
    case "WhiteOpening":
      return "Opening: capture an adjacent black piece";
    case "ForcedCapture":
      return "Capture along a line";
    case "OptionalSecond":
      return "Optional second move — capture, stack, or pass";
  }
}
