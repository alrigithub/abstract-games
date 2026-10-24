import {
  cellCoordinates,
  cellIndex,
  type BoardSnapshot,
  type SceneApi,
  type Selection,
} from '@abstract/three-engine';
import init, { BoopGame } from '../../wasm/boop_wasm.js';
import { BOOP_ANIM } from './animation';
import { PieceTracker } from './piece-tracker';
import type { GameView, MoveJson, PieceKind, PlayerId } from './types';
import { parseGameView } from './types';

const GRID = 6;
const OUTSIDE = 2;
const HUMAN: PlayerId = 'A';
const AI: PlayerId = 'B';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const stepMs = () => BOOP_ANIM.MOVE_MS + BOOP_ANIM.STEP_GAP_MS;

export interface BoopControllerOptions {
  scene: SceneApi;
  setStatus: (text: string) => void;
  getAiDepth: () => number;
  onReady?: () => void;
  /** Programmatic Tak-style drag for AI place moves (pool/resting → bed). */
  aiPlaceDrag?: (fromIndex: number, toIndex: number) => Promise<void>;
}

export class BoopController {
  private game!: BoopGame;
  private tracker = new PieceTracker();
  private view!: GameView;
  private aiGeneration = 0;
  private inputEnabled = true;
  private aiDragMode = false;
  private inflightMove: Promise<void> = Promise.resolve();
  private readonly scene: SceneApi;
  private readonly setStatus: (text: string) => void;
  private readonly getAiDepth: () => number;
  private readonly onReady?: () => void;
  private readonly aiPlaceDrag?: (fromIndex: number, toIndex: number) => Promise<void>;

  constructor(options: BoopControllerOptions) {
    this.scene = options.scene;
    this.setStatus = options.setStatus;
    this.getAiDepth = options.getAiDepth;
    this.onReady = options.onReady;
    this.aiPlaceDrag = options.aiPlaceDrag;
  }

  async init() {
    await init();
    this.newGame();
    this.onReady?.();
  }

  newGame() {
    this.aiGeneration++;
    this.game = new BoopGame();
    this.tracker.resetFromNewGame();
    this.view = parseGameView(this.game.view_json());
    this.inputEnabled = true;
    this.publishSnapshot();
    this.renderStatus('Your turn — pick up a kitten from the pool or resting pile, then place on the bed');
  }

  getSnapshot(): BoardSnapshot {
    return this.tracker.buildSnapshot(this.view);
  }

  isPlaceMode() {
    return this.view.turn_mode.kind === 'place';
  }

  canInteract() {
    return this.inputEnabled && !this.view.winner && this.view.to_move === HUMAN;
  }

  allowsPointerInteraction() {
    return this.canInteract() || this.aiDragMode;
  }

  setAiDragMode(active: boolean) {
    this.aiDragMode = active;
  }

  async waitForInflightMove() {
    await this.inflightMove;
  }

  countOnBed(player: PlayerId): number {
    let n = 0;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (this.view.board[y]?.[x]?.player === player) n++;
      }
    }
    return n;
  }

  pickHeightForCell(cell: number, snap: BoardSnapshot): number {
    if (!this.allowsPointerInteraction()) return 0;
    const { row, col } = cellCoordinates(GRID, cell, OUTSIDE);
    const stack = snap.cells[cell] ?? [];
    if (!stack.length) return 0;
    const actor = this.aiDragMode ? AI : HUMAN;

    if (this.view.turn_mode.kind === 'place') {
      if (actor === HUMAN && this.isHumanPoolCell(row, col)) return 1;
      if (actor === AI && this.isAiPoolCell(row, col)) return 1;
      if (this.isOffBedCell(row, col) && this.isRestingStackFor(stack, actor)) return 1;
      return 0;
    }
    if (this.view.turn_mode.kind === 'alternate_graduation') {
      if (row < 0 || row >= GRID || col < 0 || col >= GRID) return 0;
      const p = this.view.board[row]?.[col];
      if (p?.player === actor) return 1;
    }
    return 0;
  }

  private isHumanPoolCell(row: number, col: number) {
    if (col === -2 && row === 3) return this.view.pools[0]!.kittens_in_hand > 0;
    if (col === -2 && row === 5) return this.view.pools[0]!.cats_in_hand > 0;
    return false;
  }

  private isAiPoolCell(row: number, col: number) {
    if (col === GRID + 1 && row === 3) return this.view.pools[1]!.kittens_in_hand > 0;
    if (col === GRID + 1 && row === 5) return this.view.pools[1]!.cats_in_hand > 0;
    return false;
  }

  private isOffBedCell(row: number, col: number) {
    return row < 0 || row >= GRID || col < 0 || col >= GRID;
  }

  private isRestingStackFor(stack: BoardSnapshot['cells'][number], player: PlayerId) {
    const top = stack.at(-1);
    return top?.player === player && (top.shape === 'kitten' || top.shape === 'cat');
  }

  private sourceCellForPlacement(player: PlayerId, kind: PieceKind): number {
    const snap = this.getSnapshot();
    for (let idx = 0; idx < snap.cellCount; idx++) {
      const { row, col } = cellCoordinates(GRID, idx, OUTSIDE);
      if (!this.isOffBedCell(row, col)) continue;
      const stack = snap.cells[idx] ?? [];
      const top = stack.at(-1);
      if (top?.player === player && top.shape === kind) return idx;
    }
    if (player === HUMAN) {
      return kind === 'kitten' ? cellIndex(GRID, 3, -2, OUTSIDE)! : cellIndex(GRID, 5, -2, OUTSIDE)!;
    }
    return kind === 'kitten' ? cellIndex(GRID, 3, GRID + 1, OUTSIDE)! : cellIndex(GRID, 5, GRID + 1, OUTSIDE)!;
  }

  async commitPlacement(selection: Selection, targetIndex: number) {
    const humanPlace = this.canInteract() && this.isPlaceMode();
    const aiPlace = this.aiDragMode && this.view.to_move === AI && this.isPlaceMode();
    if (!humanPlace && !aiPlace) return;
    if (selection.count !== 1 || typeof selection.source !== 'number') return;
    const { row, col } = cellCoordinates(GRID, targetIndex, OUTSIDE);
    if (row < 0 || row >= GRID || col < 0 || col >= GRID) return;
    if (this.view.board[row]?.[col]) return;

    const kind = this.inferKindFromSource(selection.source);
    if (!kind) return;
    const player = this.view.to_move;
    const moveJson = this.game.move_for_interaction_json(player, col, row, kind);
    if (!moveJson) return;
    await this.playMoveJson(moveJson);
  }

  private inferKindFromSource(sourceIndex: number): PieceKind | null {
    const snap = this.getSnapshot();
    const top = snap.cells[sourceIndex]?.at(-1);
    if (top?.shape === 'kitten' || top?.shape === 'cat') return top.shape;
    const { row, col } = cellCoordinates(GRID, sourceIndex, OUTSIDE);
    if (col === -2 && row === 5) return 'cat';
    if (col === -2 && row === 3) return 'kitten';
    if (col === GRID + 1 && row === 5) return 'cat';
    if (col === GRID + 1 && row === 3) return 'kitten';
    return 'kitten';
  }

  private publishSnapshot() {
    this.tracker.syncBoard(this.view);
    this.scene.setSnapshot(this.tracker.buildSnapshot(this.view));
    const board = document.querySelector<HTMLElement>('[data-testid="board"]');
    if (board) board.dataset.restingCount = String(this.tracker.restingCount());
  }

  renderStatus(detail?: string) {
    if (this.view.winner) {
      const who = this.view.winner === HUMAN ? 'You win!' : 'AI wins.';
      this.setStatus(detail ? `${who} ${detail}` : who);
      return;
    }
    if (this.view.turn_mode.kind === 'choose_graduation') {
      this.setStatus(detail ?? 'Pick a graduating line (tap a cell on one line)');
      return;
    }
    if (this.view.turn_mode.kind === 'alternate_graduation') {
      this.setStatus(detail ?? 'Bed full — tap your kitten to graduate or cat to return');
      return;
    }
    if (this.view.to_move === AI) {
      this.setStatus(detail ?? 'AI thinking…');
      return;
    }
    this.setStatus(detail ?? 'Drag from pool or resting pile to an empty bed cell');
  }

  private highlightWin() {
    const h = this.view.effects.line_highlight;
    const board = document.querySelector<HTMLElement>('[data-testid="board"]');
    if (!board) return;
    if (h?.kind === 'win') {
      board.dataset.winLine = h.line.map(([x, y]) => `${x},${y}`).join(';');
    } else {
      delete board.dataset.winLine;
    }
    if (h?.kind === 'eight_cats_on_bed') board.dataset.winKind = 'eight-cats';
    else delete board.dataset.winKind;
  }

  async handleCellClick(cellIndexHit: number) {
    if (!this.inputEnabled || this.view.winner) return;
    if (this.view.to_move !== HUMAN) return;
    if (this.isPlaceMode()) return;
    const { row, col } = cellCoordinates(GRID, cellIndexHit, OUTSIDE);
    const onBed = row >= 0 && row < GRID && col >= 0 && col < GRID;
    const kind =
      (onBed ? this.view.board[row]?.[col]?.kind : undefined) ??
      this.inferKindFromSource(cellIndexHit) ??
      'kitten';
    const moveJson = this.game.move_for_interaction_json(HUMAN, col, row, kind);
    if (!moveJson) return;
    await this.playMoveJson(moveJson);
  }

  async playMoveJson(moveJson: string, options?: { scheduleAi?: boolean }) {
    const scheduleAi = options?.scheduleAi ?? true;
    const actor = this.view.to_move;
    const task = this.scene.enqueueAnimation(async () => {
      const before = parseGameView(this.game.view_json());
      this.game.apply_move_json(moveJson);
      const after = parseGameView(this.game.view_json());
      const move = JSON.parse(moveJson) as MoveJson;
      await this.animateMove(before, after, move, actor);
      this.view = after;
      this.highlightWin();
      this.renderStatus();
      if (scheduleAi && !this.view.winner && this.view.to_move === AI) {
        void this.runAiTurn();
      } else {
        this.inputEnabled = !this.view.winner && this.view.to_move === HUMAN;
      }
    });
    this.inflightMove = task;
    await task;
  }

  private async animateMove(before: GameView, after: GameView, move: MoveJson, actor: PlayerId) {
    const effects = after.effects;
    const step = stepMs();

    if (move.type === 'place') {
      const taken = this.tracker.takeForPlacement(actor, move.piece);
      if (taken?.from === 'resting') {
        this.tracker.addResting(taken.id, actor, move.piece, taken.restRow!, taken.restCol!);
        this.view = before;
        this.publishSnapshot();
        await sleep(step);
        this.tracker.removeRestingById(taken.id);
        this.tracker.placeOnBoard(move.x, move.y, taken.id);
        this.view = cloneBoardView(before, after, move.x, move.y);
        this.publishSnapshot();
        await sleep(step);
      } else if (taken) {
        this.tracker.placeOnBoard(move.x, move.y, taken.id);
        this.view = cloneBoardView(before, after, move.x, move.y);
        this.publishSnapshot();
        await sleep(step);
      }
    }

    for (const d of effects.displacements) {
      this.tracker.moveBoardId(d.from, d.to);
      this.view = after;
      this.publishSnapshot();
      await sleep(step);
    }

    for (const o of effects.off_board) {
      const id = this.tracker.ensureIdAt(o.from.x, o.from.y, o.player, o.kind);
      const { row, col } = PieceTracker.restingCell(o.from, o);
      this.view = withBoardPiece(before, o.from.x, o.from.y, o.player, o.kind);
      this.publishSnapshot();
      await sleep(step);
      this.tracker.removeFromBoard(o.from.x, o.from.y);
      this.tracker.addResting(id, o.player, o.kind, row, col);
      this.view = after;
      this.publishSnapshot();
      await sleep(step);
    }

    if (effects.graduated_cells) {
      for (const [x, y] of effects.graduated_cells) this.tracker.removeFromBoard(x, y);
      this.view = after;
      this.publishSnapshot();
      await sleep(step);
    }

    this.view = after;
    this.publishSnapshot();
  }

  private async runAiTurn() {
    this.inputEnabled = false;
    this.renderStatus();
    await sleep(BOOP_ANIM.AI_PAUSE_MS);
    const moveJson = this.game.choose_ai_move(this.getAiDepth());
    if (!moveJson) {
      this.inputEnabled = true;
      this.renderStatus('AI stuck');
      return;
    }
    const move = JSON.parse(moveJson) as MoveJson;
    if (move.type === 'place' && this.aiPlaceDrag) {
      const from = this.sourceCellForPlacement(AI, move.piece);
      const to = cellIndex(GRID, move.y, move.x, OUTSIDE)!;
      await this.aiPlaceDrag(from, to);
      return;
    }
    await this.playMoveJson(moveJson);
  }

  async smokePlace(x = 2, y = 2) {
    const mv = this.game.move_for_interaction_json(HUMAN, x, y, 'kitten');
    if (mv) await this.playMoveJson(mv, { scheduleAi: false });
  }

  async ensureRestingOffBoardPiece() {
    this.newGame();
    const m0 = this.game.move_for_interaction_json(HUMAN, 0, 0, 'kitten');
    if (!m0) return false;
    await this.playMoveJson(m0, { scheduleAi: false });
    const boop = this.game.move_for_interaction_json(AI, 1, 0, 'kitten');
    if (!boop) return false;
    await this.playMoveJson(boop, { scheduleAi: false });
    await sleep(stepMs());
    return this.tracker.restingCount() > 0;
  }
}

function cloneBoardView(before: GameView, after: GameView, x: number, y: number): GameView {
  const board = before.board.map(row => row.map(c => (c ? { ...c } : null)));
  board[y]![x] = after.board[y]![x] ? { ...after.board[y]![x]! } : null;
  return { ...before, board, pools: after.pools, effects: { ...after.effects, displacements: [], off_board: [] } };
}

function withBoardPiece(
  base: GameView,
  x: number,
  y: number,
  player: string,
  kind: string,
): GameView {
  const board = base.board.map(row => row.map(c => (c ? { ...c } : null)));
  board[y]![x] = { player: player as PlayerId, kind: kind as PieceKind };
  return { ...base, board };
}
