import { createAiWorkerBridge, theme } from "@abstract/pixi-shared";
import type { MoveJson, Player, RenderState } from "./types";
import {
  wasmApplyMove,
  wasmCancelRingSelection,
  wasmNewGame,
} from "./wasm-api";

export type VisualEvent =
  | { kind: "addRing"; coord: { x: number; y: number }; player: Player }
  | { kind: "addMarker"; coord: { x: number; y: number }; player: Player }
  | {
      kind: "moveRing";
      from: { x: number; y: number };
      to: { x: number; y: number };
      player: Player;
    }
  | {
      kind: "flipMarkers";
      coords: { x: number; y: number }[];
    }
  | { kind: "removeRun"; coords: { x: number; y: number }[] }
  | {
      kind: "removeRingToRack";
      coord: { x: number; y: number };
      player: Player;
      slot: number;
    };

export type GameListener = (ev: {
  state: RenderState;
  status: string;
  visual: VisualEvent[];
  aiThinking: boolean;
}) => void;

function cloneState(s: RenderState): RenderState {
  return JSON.parse(JSON.stringify(s)) as RenderState;
}

function eventsForMove(
  before: RenderState,
  move: MoveJson,
  after: RenderState,
): VisualEvent[] {
  const out: VisualEvent[] = [];
  const player = before.active_player;
  switch (move.type) {
    case "placeRing":
      out.push({ kind: "addRing", coord: move.coord, player });
      break;
    case "placeMarker":
      out.push({ kind: "addMarker", coord: move.coord, player });
      break;
    case "moveRing": {
      out.push({
        kind: "moveRing",
        from: move.start,
        to: move.end,
        player,
      });
      const flipped: { x: number; y: number }[] = [];
      for (const c of before.board.markers_a) {
        if (onSegment(c, move.start, move.end)) flipped.push(c);
      }
      for (const c of before.board.markers_b) {
        if (onSegment(c, move.start, move.end)) flipped.push(c);
      }
      if (flipped.length) out.push({ kind: "flipMarkers", coords: flipped });
      break;
    }
    case "removeRun": {
      const line = runLineFromSeed(before, move.seed);
      out.push({ kind: "removeRun", coords: line });
      break;
    }
    case "removeRing": {
      const slot = (player === "A" ? after.points_a : after.points_b) - 1;
      out.push({
        kind: "removeRingToRack",
        coord: move.coord,
        player,
        slot: Math.max(0, slot),
      });
      break;
    }
    case "wait":
      break;
  }
  return out;
}

function onSegment(
  c: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  if (!sameLine(a, b, c)) return false;
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY;
}

function sameLine(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean {
  return (
    a.x === b.x && b.x === c.x ||
    a.y === b.y && b.y === c.y ||
    a.x - a.y === b.x - b.y && b.x - b.y === c.x - c.y
  );
}

/** Approximate run line for VFX (exact line comes from engine on remove). */
function runLineFromSeed(
  state: RenderState,
  seed: { x: number; y: number },
): { x: number; y: number }[] {
  const player = state.active_player;
  const markers =
    player === "A" ? state.board.markers_a : state.board.markers_b;
  if (!markers.some((m) => m.x === seed.x && m.y === seed.y)) {
    return [seed];
  }
  for (const axis of [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
  ] as const) {
    const line = collectRun(markers, seed, axis.dx, axis.dy);
    if (line.length >= 5) return line.slice(0, 5);
  }
  return [seed];
}

function collectRun(
  markers: { x: number; y: number }[],
  seed: { x: number; y: number },
  dx: number,
  dy: number,
): { x: number; y: number }[] {
  const set = new Set(markers.map((m) => `${m.x},${m.y}`));
  const line: { x: number; y: number }[] = [seed];
  for (const sign of [-1, 1] as const) {
    let x = seed.x;
    let y = seed.y;
    for (;;) {
      x += sign * dx;
      y += sign * dy;
      const k = `${x},${y}`;
      if (!set.has(k)) break;
      if (sign === 1) line.push({ x, y });
      else line.unshift({ x, y });
    }
  }
  return line;
}

export class GameController {
  private state: RenderState | null = null;
  private listener: GameListener | null = null;
  private animating = false;
  private scoringLinger = false;
  private aiThinking = false;
  private aiDepth = 10;
  private aiBridge = createAiWorkerBridge(
    new URL("./ai-worker.ts", import.meta.url),
  );
  private aiReqId = 0;
  private pendingAiId: number | null = null;
  private deferredAi = false;

  constructor() {
    this.aiBridge.setHandler(({ id, moveJson, error }) => {
      if (this.pendingAiId !== id) return;
      this.pendingAiId = null;
      this.aiThinking = false;
      if (error) {
        this.notify("AI error: " + error);
        return;
      }
      void this.applyMove(JSON.parse(moveJson) as MoveJson, false);
    });
  }

  setAiDepth(depth: number) {
    this.aiDepth = depth;
  }

  onUpdate(fn: GameListener) {
    this.listener = fn;
  }

  async start() {
    this.state = await wasmNewGame();
    this.notify("Place a ring");
    void this.afterStateSettled();
  }

  getState(): RenderState | null {
    return this.state ? cloneState(this.state) : null;
  }

  isBusy(): boolean {
    return this.animating || this.scoringLinger || this.aiThinking;
  }

  async humanClick(coord: { x: number; y: number }) {
    if (!this.state || this.isBusy()) return;
    if (!this.state.human_turn) return;

    const move = this.pickMoveForClick(this.state, coord);
    if (!move) return;
    await this.applyMove(move, true);
  }

  async cancelRingSelection() {
    if (!this.state || this.isBusy()) return;
    const tm = this.state.turn_mode;
    if (typeof tm !== "object" || !("RingMovement" in tm)) return;
    this.state = await wasmCancelRingSelection(this.state);
    this.notify("Click your ring to move it");
    this.emit();
  }

  private pickMoveForClick(
    state: RenderState,
    coord: { x: number; y: number },
  ): MoveJson | null {
    for (const m of state.legal_moves) {
      switch (m.type) {
        case "placeRing":
        case "placeMarker":
        case "removeRing":
          if (m.coord.x === coord.x && m.coord.y === coord.y) return m;
          break;
        case "removeRun":
          if (m.seed.x === coord.x && m.seed.y === coord.y) return m;
          break;
        case "moveRing":
          if (m.end.x === coord.x && m.end.y === coord.y) return m;
          break;
        case "wait":
          break;
      }
    }
    if (
      typeof state.turn_mode === "object" &&
      "WaitForRingMovement" in state.turn_mode
    ) {
      const start = state.turn_mode.WaitForRingMovement;
      if (start.x === coord.x && start.y === coord.y) {
        return { type: "wait" };
      }
    }
    if (
      typeof state.turn_mode === "object" &&
      "RingMovement" in state.turn_mode
    ) {
      const start = state.turn_mode.RingMovement;
      if (start.x === coord.x && start.y === coord.y) {
        return { type: "wait" };
      }
    }
    return null;
  }

  private async applyMove(move: MoveJson, fromHuman: boolean) {
    if (!this.state) return;
    const before = cloneState(this.state);
    this.state = await wasmApplyMove(before, move);
    const after = this.state;
    const visual = eventsForMove(before, move, after);
    const hadRingRemoval =
      move.type === "removeRing" &&
      typeof before.turn_mode === "object" &&
      "RingRemoval" in before.turn_mode;

    this.animating = visual.length > 0 && move.type !== "wait";

    if (hadRingRemoval) {
      this.scoringLinger = true;
      setTimeout(() => {
        this.scoringLinger = false;
        if (this.deferredAi) {
          this.deferredAi = false;
          void this.queueAi();
        } else {
          void this.afterStateSettled();
        }
      }, theme.scoreLingerMs);
    }

    const duration = this.animationDuration(visual);
    if (duration > 0) {
      setTimeout(() => {
        this.animating = false;
        if (!this.scoringLinger) void this.afterStateSettled();
      }, duration);
    } else {
      this.animating = false;
      if (!this.scoringLinger) void this.afterStateSettled();
    }

    this.notify(this.statusText(fromHuman));
    this.emit(visual);
  }

  private animationDuration(visual: VisualEvent[]): number {
    if (visual.some((v) => v.kind === "moveRing" || v.kind === "flipMarkers"))
      return theme.animMs;
    if (visual.some((v) => v.kind === "removeRingToRack")) return theme.animMs;
    if (visual.length > 0) return theme.animMs * 0.35;
    return 0;
  }

  private async afterStateSettled() {
    if (!this.state || this.isBusy()) return;

    if (this.state.auto_wait && this.state.human_turn) {
      await this.applyMove({ type: "wait" }, true);
      return;
    }

    if (
      this.state.active_player === "B" &&
      !this.state.winner &&
      !this.scoringLinger
    ) {
      await this.queueAi();
    }
  }

  private async queueAi() {
    if (!this.state || this.aiThinking) return;
    if (this.scoringLinger) {
      this.deferredAi = true;
      return;
    }
    this.aiThinking = true;
    this.notify("Floyd is thinking…");
    this.emit();
    const id = ++this.aiReqId;
    this.pendingAiId = id;
    this.aiBridge.post({
      id,
      stateJson: JSON.stringify(this.state),
      depth: this.aiDepth,
    });
  }

  private statusText(fromHuman: boolean): string {
    if (!this.state) return "";
    if (this.state.winner) {
      return this.state.winner === "A" ? "You win!" : "Floyd wins!";
    }
    if (this.aiThinking) return "Floyd is thinking…";
    if (!fromHuman && this.state.active_player === "A") {
      return "Your turn";
    }
    return turnStatus(this.state);
  }

  private notify(status: string, visual: VisualEvent[] = []) {
    if (!this.state) return;
    this.listener?.({
      state: cloneState(this.state),
      status,
      visual,
      aiThinking: this.aiThinking,
    });
  }

  private emit(visual: VisualEvent[] = []) {
    if (!this.state) return;
    this.listener?.({
      state: cloneState(this.state),
      status: this.statusText(true),
      visual,
      aiThinking: this.aiThinking,
    });
  }
}

function turnStatus(state: RenderState): string {
  if (state.winner) return "Game over";
  const tm = state.turn_mode;
  if (tm === "RingPlacement") return "Place a ring";
  if (tm === "MarkerPlacement") return "Place a marker in your ring";
  if (typeof tm === "object" && "WaitForRingMovement" in tm)
    return "Click your ring to move it";
  if (typeof tm === "object" && "RingMovement" in tm) return "Move your ring";
  if (typeof tm === "object" && "RunRemoval" in tm) return "Remove a five";
  if (typeof tm === "object" && "RingRemoval" in tm)
    return "Remove one of your rings";
  return "Your turn";
}
