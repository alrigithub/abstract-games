import { applyMove, createGame, placementColor, winnerScore } from './game/engine';
import { spreadToMove } from './game/spread';
import type { GameState, Move } from './game/engine';
import { AiWorkerSession, recordAiThinkMetrics, type AiStrengthSearchOptions, type SceneApi } from '@abstract/three-engine';
import { legalMoves } from './game/engine';
import type { Color, Selection } from './types';

interface GameUiOptions {
  scene: SceneApi;
  onActive(active: boolean): void;
  onBoard(game: GameState): void;
  setStatus(text: string): void;
  getAiSearchOptions(): AiStrengthSearchOptions;
  aiStrengthLabel(): string;
}

export function createGameUi(options: GameUiOptions) {
  const panel = document.createElement('section');
  panel.className = 'game-controls';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Game controls');
  panel.innerHTML = `<div class="game-pieces"><button data-piece="flat" data-testid="piece-flat" aria-pressed="true">Flat</button><button data-piece="standing" data-testid="piece-wall" aria-pressed="false">Wall</button><button data-piece="capstone" data-testid="piece-cap" aria-pressed="false">Capstone</button></div><button class="game-next" hidden>Next round</button>`;
  document.querySelector('#app')!.append(panel);
  const end = document.querySelector<HTMLButtonElement>('#end-turn')!;
  const undo = document.querySelector<HTMLButtonElement>('#undo')!;
  let active = false;
  let mode: 'local' | 'ai' = 'local';
  let game: GameState = createGame(5);
  let draft: { move: Move; game: GameState } | null = null;
  let piece: 'flat' | 'standing' | 'capstone' = 'flat';
  let round = 1;
  let firstColor: Color = 'ivory';
  const scores = [0, 0];
  let aiPending = false;
  const aiSession = new AiWorkerSession();
  let generation = 0;
  const humanTurn = () => !aiPending && !game.result && (mode === 'local' || (mode === 'ai' && game.toMove === firstColor));
  const colorName = (color: Color) => (color === 'ivory' ? 'White' : 'Black');
  const playableCells = () => game.board.size ** 2;

  function render(message?: string) {
    if (!active) return;
    options.onBoard(draft?.game ?? game);
    const result = game.result;
    const otherColor = firstColor === 'ivory' ? 'charcoal' : 'ivory';
    const seats = `Round ${round} · ${mode === 'ai' ? 'You' : 'P1'} ${colorName(firstColor)} ${scores[0]} – ${mode === 'ai' ? 'AI' : 'P2'} ${colorName(otherColor)} ${scores[1]}`;
    const detail =
      message ??
      (draft
        ? 'Move ready · End turn to confirm'
        : result
          ? result.winner
            ? `${colorName(result.winner)} wins by ${result.reason}`
            : 'Draw'
          : `${colorName(game.toMove)} to move${game.ply < 2 ? ` · Place a ${colorName(placementColor(game))} flat` : ''}${aiPending ? ' · AI thinking…' : ''}`);
    const strength = mode === 'ai' ? ` · AI ${options.aiStrengthLabel()}` : '';
    options.setStatus(`${seats} · ${detail}${strength}`);
    end.disabled = !draft || !humanTurn();
    undo.disabled = !draft;
    panel.querySelectorAll<HTMLButtonElement>('[data-piece]').forEach(button => {
      const choice = button.dataset.piece as typeof piece;
      button.setAttribute('aria-pressed', String(choice === piece));
      button.disabled = !humanTurn() || !!draft || (game.ply < 2 && choice !== 'flat');
    });
  }

  function stage(move: Move) {
    if (!active || !humanTurn() || draft) return false;
    try {
      draft = { move, game: applyMove(game, move) };
      render();
      return true;
    } catch (error) {
      render(error instanceof Error ? error.message : 'Illegal move');
      return false;
    }
  }

  function placementMove(target: number, source?: number): Move | null {
    if (target < 0 || target >= playableCells() || game.board.cells[target]!.length) return null;
    const reserveSource = source !== undefined && source >= playableCells() ? source : undefined;
    const reserveTop = reserveSource !== undefined ? game.board.cells[reserveSource]?.at(-1) : undefined;
    const pieceId = reserveTop?.id;
    if (game.ply < 2) {
      return { type: 'place', to: target, kind: 'stone', orientation: 'flat', source: reserveSource, pieceId };
    }
    if (reserveTop?.kind === 'capstone' || piece === 'capstone') {
      return { type: 'place', to: target, kind: 'capstone', orientation: 'flat', source: reserveSource, pieceId };
    }
    const orientation =
      reserveTop?.kind === 'stone'
        ? reserveTop.orientation
        : piece === 'standing'
          ? 'standing'
          : 'flat';
    return {
      type: 'place',
      to: target,
      kind: 'stone',
      orientation,
      source: reserveSource,
      pieceId,
    };
  }

  function stopAi() {
    generation++;
    aiSession.cancel();
    aiPending = false;
  }

  async function maybeAi() {
    if (!active || mode !== 'ai' || game.result || game.toMove === firstColor || aiPending) return;
    aiPending = true;
    render();
    const id = ++generation;
    const search = options.getAiSearchOptions();
    const t0 = performance.now();
    const move = await aiSession.request<Move | null>({
      createWorker: () => new Worker(new URL('./game/ai.worker.ts', import.meta.url), { type: 'module' }),
      postMessage: (worker, requestId) => worker.postMessage({ id: requestId, game, options: search }),
      parseMessage: (event, requestId) => {
        const data = event.data as { id: number; move: Move | null };
        if (data.id !== requestId) return undefined;
        return data.move;
      },
      timeBudgetMs: search.maxTimeMs,
    });
    recordAiThinkMetrics(performance.now() - t0);
    if (id !== generation || !active) return;
    aiPending = false;
    const resolved = move ?? legalMoves(game)[0] ?? null;
    if (resolved) {
      options.scene.enqueueAnimation(async () => {
        game = applyMove(game, resolved);
        countResult();
        render();
        void maybeAi();
      });
    } else {
      render('AI could not move.');
    }
  }

  function countResult() {
    if (!game.result?.winner) return;
    const seat = game.result.winner === firstColor ? 0 : 1;
    scores[seat] = scores[seat]! + winnerScore(game);
  }

  panel.querySelectorAll<HTMLButtonElement>('[data-piece]').forEach(button =>
    button.addEventListener('click', () => {
      piece = button.dataset.piece as typeof piece;
      render();
    }),
  );

  return {
    isActive: () => active,
    humanTurn,
    playableCells,
    getGame: () => game,
    commitDrag(selection: Selection, target: number) {
      if (!active || !humanTurn() || draft || target < 0 || target >= playableCells()) return;
      const source = selection.source;
      if (typeof source === 'number') {
        if (source >= playableCells()) {
          const move = placementMove(target, source);
          if (move) stage(move);
          else render('Choose an empty square.');
          return;
        }
        if (source === target) return;
        const move = spreadToMove(game, source, target, selection.count);
        if (move) stage(move);
        else render('Illegal stack move.');
        return;
      }
      const move = placementMove(target);
      if (move) stage(move);
      else render('Choose an empty square.');
    },
    startAi(human: Color, size: number) {
      stopAi();
      active = true;
      mode = 'ai';
      draft = null;
      round = 1;
      scores[0] = scores[1] = 0;
      firstColor = human;
      piece = 'flat';
      game = createGame(size === 7 ? 5 : size);
      panel.hidden = false;
      options.onActive(true);
      render();
      maybeAi();
    },
    restartRound() {
      if (!active) return;
      stopAi();
      draft = null;
      piece = 'flat';
      game = createGame(game.board.size);
      render();
      maybeAi();
    },
    startLocal(size: number) {
      stopAi();
      active = true;
      mode = 'local';
      draft = null;
      round = 1;
      scores[0] = scores[1] = 0;
      firstColor = 'ivory';
      piece = 'flat';
      game = createGame(size === 7 ? 5 : size);
      panel.hidden = false;
      options.onActive(true);
      render();
    },
    stop() {
      stopAi();
      active = false;
      draft = null;
      panel.hidden = true;
      options.onActive(false);
    },
    undo() {
      if (active) {
        draft = null;
        render();
      }
    },
    endTurn() {
      if (!active || !draft || !humanTurn()) return;
      game = draft.game;
      draft = null;
      countResult();
      render();
      maybeAi();
    },
    refresh: () => render(),
    canFlipReserveSelection(selection: Selection | null) {
      if (!active || !humanTurn() || draft || !selection || typeof selection.source !== 'number') return false;
      if (selection.source < playableCells()) return false;
      const top = game.board.cells[selection.source]?.at(-1);
      return !!top && top.kind === 'stone' && game.ply >= 2;
    },
    flipReserveSelection(selection: Selection) {
      if (!this.canFlipReserveSelection(selection)) return null;
      const source = selection.source as number;
      const stack = game.board.cells[source]!;
      const top = stack.at(-1)!;
      const cells = game.board.cells.slice();
      cells[source] = [
        ...stack.slice(0, -1),
        { ...top, orientation: top.orientation === 'flat' ? 'standing' : 'flat' },
      ];
      game = { ...game, board: { ...game.board, cells } };
      render();
      return top.id;
    },
    canFlipStone() {
      return active && humanTurn() && !draft && game.ply >= 2 && piece !== 'capstone';
    },
    toggleStoneOrientation() {
      if (!active || !humanTurn() || draft || game.ply < 2 || piece === 'capstone') return;
      piece = piece === 'standing' ? 'flat' : 'standing';
      render();
    },
    dispose() {
      stopAi();
      panel.remove();
    },
  };
}
