import { attachAiWorkerBridge, theme } from "@abstract/pixi-shared";
import AiWorker from "./ai-worker.ts?worker";
import {
  applyMove,
  createGame,
  opposite,
  placementColor,
  type GameState,
  type Move,
} from "./engine";
import type { PlaceSelection } from "./place-selection";

export const HUMAN: "ivory" = "ivory";
export const AI: "charcoal" = "charcoal";

export type GameListener = (ev: {
  game: GameState;
  status: string;
  interactive: boolean;
  selection: PlaceSelection | null;
  selectedStack: number | null;
  aiThinking: boolean;
  roadLingerMs: number;
}) => void;

export class GameController {
  private game: GameState = createGame(5);
  private listener: GameListener | null = null;
  private aiThinking = false;
  private aiDepth = 2;
  private aiNodes = 4000;
  private aiReqId = 0;
  private pendingAiId: number | null = null;
  private aiBridge = attachAiWorkerBridge(new AiWorker());
  private selection: PlaceSelection | null = {
    kind: "stone",
    orientation: "flat",
  };
  private selectedStack: number | null = null;
  private roadLingerMs = 0;
  private roadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.aiBridge.setHandler(({ id, moveJson, error }) => {
      if (this.pendingAiId !== id) return;
      this.pendingAiId = null;
      this.aiThinking = false;
      if (error) {
        this.notify("AI error: " + error);
        this.emit();
        return;
      }
      if (moveJson) {
        this.applyMoveInternal(JSON.parse(moveJson) as Move, false);
      } else {
        this.notify("AI had no move");
        this.emit();
      }
    });
  }

  setAiStrength(depth: number) {
    this.aiDepth = Math.max(1, Math.min(4, depth));
    this.aiNodes = 1200 + depth * 600;
  }

  onUpdate(fn: GameListener) {
    this.listener = fn;
  }

  getGame(): GameState {
    return this.game;
  }

  getSelection(): PlaceSelection | null {
    return this.selection;
  }

  setSelection(s: PlaceSelection | null) {
    this.selection = s;
    this.emit();
  }

  getSelectedStack(): number | null {
    return this.selectedStack;
  }

  setSelectedStack(c: number | null) {
    this.selectedStack = c;
    this.emit();
  }

  isHumanTurn(): boolean {
    if (this.game.result) return false;
    if (this.aiThinking) return false;
    if (this.roadLingerMs > 0) return false;
    return this.game.toMove === HUMAN;
  }

  start() {
    this.game = createGame(5);
    this.selection = { kind: "stone", orientation: "flat" };
    this.selectedStack = null;
    this.roadLingerMs = 0;
    this.notify(this.statusText(true));
    this.emit();
    void this.afterHumanTurn();
  }

  playHumanMove(move: Move) {
    if (!this.isHumanTurn()) return;
    this.applyMoveInternal(move, true);
  }

  private applyMoveInternal(move: Move, fromHuman: boolean) {
    try {
      this.game = applyMove(this.game, move);
    } catch {
      return;
    }
    this.selectedStack = null;
    if (this.game.ply < 2) {
      this.selection = { kind: "stone", orientation: "flat" };
    }
    if (this.game.result?.reason === "road") {
      this.roadLingerMs = theme.scoreLingerMs;
      if (this.roadTimer) clearTimeout(this.roadTimer);
      this.roadTimer = setTimeout(() => {
        this.roadLingerMs = 0;
        this.emit();
      }, theme.scoreLingerMs);
    }
    this.notify(this.statusText(fromHuman));
    this.emit();
    if (!this.game.result) void this.afterHumanTurn();
  }

  private async afterHumanTurn() {
    if (this.game.result) return;
    if (this.roadLingerMs > 0) return;
    if (this.game.toMove === AI) {
      await this.queueAi();
    }
  }

  private queueAi(): Promise<void> {
    if (this.aiThinking || this.game.result) return Promise.resolve();
    this.aiThinking = true;
    this.notify("Floyd is thinking…");
    this.emit();
    const id = ++this.aiReqId;
    this.pendingAiId = id;
    const snapshot = structuredClone(this.game) as GameState;
    this.aiBridge.post({
      id,
      stateJson: JSON.stringify({
        game: snapshot,
        maxDepth: this.aiDepth,
        maxNodes: this.aiNodes,
      }),
      depth: this.aiDepth,
    });
    return Promise.resolve();
  }

  private statusText(fromHuman: boolean): string {
    if (this.game.result) {
      const w = this.game.result.winner;
      if (!w) return "Draw on flats.";
      const who = w === HUMAN ? "You" : "Floyd";
      const how =
        this.game.result.reason === "road" ? "road win" : "flat count";
      return `${who} win (${how}).`;
    }
    if (this.game.ply < 2) {
      const color = placementColor(this.game);
      const who = color === HUMAN ? "You" : "Floyd";
      return `${who}: place an opening flat`;
    }
    if (fromHuman) {
      return `Floyd (${opposite(HUMAN)}) to move`;
    }
    return "Your turn (Ivory)";
  }

  private notify(text: string) {
    this._status = text;
  }

  private _status = "";

  getStatus(): string {
    return this._status;
  }

  private emit() {
    this.listener?.({
      game: this.game,
      status: this._status,
      interactive: this.isHumanTurn(),
      selection: this.selection,
      selectedStack: this.selectedStack,
      aiThinking: this.aiThinking,
      roadLingerMs: this.roadLingerMs,
    });
  }
}
