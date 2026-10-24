import { ANIMATION, cellCoordinates, type SceneApi } from '@abstract/three-engine';
import init, { BoopGame } from '../../wasm/boop_wasm.js';
import { PieceTracker } from './piece-tracker';
import type { GameView, MoveJson, PieceKind, PlayerId } from './types';
import { parseGameView } from './types';

const GRID = 6;
const OUTSIDE = 2;
const HUMAN: PlayerId = 'A';
const AI: PlayerId = 'B';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface BoopControllerOptions {
  scene: SceneApi;
  setStatus: (text: string) => void;
  getAiDepth: () => number;
  onReady?: () => void;
}

export class BoopController {
  private game!: BoopGame;
  private tracker = new PieceTracker();
  private view!: GameView;
  private selectedKind: PieceKind = 'kitten';
  private aiGeneration = 0;
  private inputEnabled = true;
  private readonly scene: SceneApi;
  private readonly setStatus: (text: string) => void;
  private readonly getAiDepth: () => number;
  private readonly onReady?: () => void;

  constructor(options: BoopControllerOptions) {
    this.scene = options.scene;
    this.setStatus = options.setStatus;
    this.getAiDepth = options.getAiDepth;
    this.onReady = options.onReady;
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
    this.renderStatus('Your turn — tap kittens pool (left), then an empty cell');
  }

  canInteract() {
    return this.inputEnabled && !this.view.winner && this.view.to_move === HUMAN;
  }

  selectPoolKind(kind: PieceKind) {
    this.selectedKind = kind;
    if (this.canInteract()) this.renderStatus(`Selected ${kind} — tap an empty cell`);
  }

  private publishSnapshot() {
    this.tracker.syncBoard(this.view);
    this.scene.setSnapshot(this.tracker.buildSnapshot(this.view));
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
    this.setStatus(detail ?? `Your turn · ${this.selectedKind} selected`);
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
    const { row, col } = cellCoordinates(GRID, cellIndexHit, OUTSIDE);
    if (row === 3 && col === -2) {
      this.handlePoolClick();
      return;
    }
    if (this.view.to_move !== HUMAN) return;
    const moveJson = this.game.move_for_interaction_json(HUMAN, col, row, this.selectedKind);
    if (!moveJson) return;
    await this.playMoveJson(moveJson);
  }

  handlePoolClick() {
    if (!this.canInteract()) return;
    const pool = this.view.pools[0]!;
    if (pool.kittens_in_hand > 0) this.selectPoolKind('kitten');
    else if (pool.cats_in_hand > 0) this.selectPoolKind('cat');
  }

  private async playMoveJson(moveJson: string) {
    const move = JSON.parse(moveJson) as MoveJson;
    const actor = this.view.to_move;
    await this.scene.enqueueAnimation(async () => {
      const before = parseGameView(this.game.view_json());
      this.game.apply_move_json(moveJson);
      const after = parseGameView(this.game.view_json());
      await this.animateMove(before, after, move, actor);
      this.view = after;
      this.highlightWin();
      this.renderStatus();
      if (!this.view.winner && this.view.to_move === AI) await this.runAiTurn();
      else this.inputEnabled = !this.view.winner && this.view.to_move === HUMAN;
    });
  }

  private async animateMove(before: GameView, after: GameView, move: MoveJson, actor: PlayerId) {
    const effects = after.effects;
    const step = ANIMATION.DURATION + 25;

    if (move.type === 'place') {
      const id = this.tracker.takeFromPool(actor, move.piece);
      if (id) this.tracker.placeOnBoard(move.x, move.y, id);
      this.view = cloneBoardView(before, after, move.x, move.y);
      this.publishSnapshot();
      await sleep(step);
    }

    for (const d of effects.displacements) {
      this.tracker.moveBoardId(d.from, d.to);
      this.view = after;
      this.publishSnapshot();
      await sleep(step);
    }

    for (const o of effects.off_board) {
      const id = this.tracker.removeFromBoard(o.from.x, o.from.y);
      if (id) this.tracker.returnToPool(o.player, o.kind, id);
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
    await sleep(60);
    const moveJson = this.game.choose_ai_move(this.getAiDepth());
    if (!moveJson) {
      this.inputEnabled = true;
      this.renderStatus('AI stuck');
      return;
    }
    await this.playMoveJson(moveJson);
  }

  async smokePlace(x = 2, y = 2) {
    const mv = this.game.move_for_interaction_json(HUMAN, x, y, 'kitten');
    if (mv) await this.playMoveJson(mv);
  }
}

function cloneBoardView(before: GameView, after: GameView, x: number, y: number): GameView {
  const board = before.board.map(row => row.map(c => (c ? { ...c } : null)));
  board[y]![x] = after.board[y]![x] ? { ...after.board[y]![x]! } : null;
  return { ...before, board, pools: after.pools, effects: { ...after.effects, displacements: [], off_board: [] } };
}
