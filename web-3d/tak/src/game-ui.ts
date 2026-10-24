import { applyMove, createGame, placementColor, winnerScore } from './game/engine';
import { spreadToMove } from './game/spread';
import type { GameState, Move } from './game/engine';
import type { AiStrengthSearchOptions, SceneApi } from '@abstract/three-engine';
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
  let aiWorker: Worker | null = null;
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

  function placementMove(target: number): Move | null {
    if (target < 0 || target >= playableCells() || game.board.cells[target]!.length) return null;
    if (game.ply < 2) {
      return { type: 'place', to: target, kind: 'stone', orientation: 'flat' };
    }
    if (piece === 'capstone') return { type: 'place', to: target, kind: 'capstone', orientation: 'flat' };
    return {
      type: 'place',
      to: target,
      kind: 'stone',
      orientation: piece === 'standing' ? 'standing' : 'flat',
    };
  }

  function stopAi() {
    generation++;
    aiWorker?.terminate();
    aiWorker = null;
    aiPending = false;
  }

  function maybeAi() {
    if (!active || mode !== 'ai' || game.result || game.toMove === firstColor) return;
    aiPending = true;
    render();
    const id = ++generation;
    const search = options.getAiSearchOptions();
    aiWorker = new Worker(new URL('./game/ai.worker.ts', import.meta.url), { type: 'module' });
    aiWorker.onmessage = (event: MessageEvent<{ id: number; move: Move | null }>) => {
      if (event.data.id !== generation || id !== generation || !active) return;
      aiWorker?.terminate();
      aiWorker = null;
      aiPending = false;
      if (event.data.move) {
        options.scene.enqueueAnimation(async () => {
          game = applyMove(game, event.data.move!);
          countResult();
          render();
        });
      } else render('AI could not move.');
    };
    aiWorker.postMessage({ id, game, options: search });
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
          const move = placementMove(target);
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
    dispose() {
      stopAi();
      panel.remove();
    },
  };
}
