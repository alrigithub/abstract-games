import { applyMove, createGame, placementColor, winnerScore } from './game/engine';
import type { GameState, Move } from './game/engine';
import type { Color } from './types';
import type { SceneApi } from '@abstract/three-engine';

interface GameUiOptions {
  scene: SceneApi;
  board: HTMLElement;
  onActive(active: boolean): void;
  onBoard(game: GameState): void;
}

export function createGameUi(options: GameUiOptions) {
  const panel = document.createElement('section');
  panel.className = 'game-controls';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Game controls');
  panel.innerHTML = `<p class="game-status" role="status" aria-live="polite" data-testid="game-status"></p><div class="game-pieces"><button data-piece="flat" data-testid="piece-flat" aria-pressed="true">Flat</button><button data-piece="standing" data-testid="piece-wall" aria-pressed="false">Wall</button><button data-piece="capstone" data-testid="piece-cap" aria-pressed="false">Capstone</button><button data-spread data-testid="piece-spread" aria-pressed="false">Move stack</button></div><button class="game-next" hidden>Next round</button>`;
  document.querySelector('#app')!.append(panel);
  const dialog = document.createElement('dialog');
  dialog.className = 'spread-dialog';
  dialog.innerHTML = `<form method="dialog" class="menu-form"><h2>Move stack</h2><label for="spread-direction">Direction</label><select id="spread-direction"><option value="north">North ↑</option><option value="east">East →</option><option value="south">South ↓</option><option value="west">West ←</option></select><label for="spread-drops">Pieces to drop on each square</label><input id="spread-drops" value="1" inputmode="numeric" autocomplete="off" pattern="[1-8]( +[1-8])*" required><p class="menu-note">Enter one count per square, for example 1 2.</p><p class="spread-error" role="alert"></p><button type="button" class="menu-submit" data-stage>Preview move</button><button class="menu-secondary">Cancel</button></form>`;
  document.querySelector('#app')!.append(dialog);
  const status = panel.querySelector<HTMLParagraphElement>('.game-status')!;
  const end = document.querySelector<HTMLButtonElement>('#end-turn')!;
  const undo = document.querySelector<HTMLButtonElement>('#undo')!;
  let active = false;
  let mode: 'local' | 'ai' = 'local';
  let game: GameState = createGame(5);
  let draft: { move: Move; game: GameState } | null = null;
  let piece: 'flat' | 'standing' | 'capstone' | 'spread' = 'flat';
  let from = 0;
  let spreadGame: GameState | null = null;
  let round = 1;
  let firstColor: Color = 'ivory';
  const scores = [0, 0];
  let aiPending = false;
  let aiWorker: Worker | null = null;
  let generation = 0;
  const humanTurn = () => !aiPending && !game.result && (mode === 'local' || (mode === 'ai' && game.toMove === firstColor));
  const colorName = (color: Color) => (color === 'ivory' ? 'White' : 'Black');

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
    status.textContent = `${seats} · ${detail}`;
    end.disabled = !draft || !humanTurn();
    undo.disabled = !draft;
    panel.querySelectorAll<HTMLButtonElement>('[data-piece], [data-spread]').forEach(button => {
      const choice = button.dataset.piece ?? 'spread';
      button.setAttribute('aria-pressed', String(choice === piece));
      button.disabled = !humanTurn() || !!draft || (game.ply < 2 && choice !== 'flat');
    });
  }

  function stage(move: Move) {
    if (!active || !humanTurn() || draft) return;
    try {
      draft = { move, game: applyMove(game, move) };
      render();
    } catch (error) {
      render(error instanceof Error ? error.message : 'Illegal move');
    }
  }

  function activate(index: number) {
    if (!active || !humanTurn() || draft || index < 0 || index >= game.board.size ** 2) return;
    if (piece === 'spread') {
      const top = game.board.cells[index]?.at(-1);
      if (top?.color !== game.toMove) {
        render('Choose your stack.');
        return;
      }
      from = index;
      spreadGame = game;
      dialog.querySelector<HTMLInputElement>('#spread-drops')!.value = '1';
      dialog.showModal();
    } else {
      stage({
        type: 'place',
        to: index,
        kind: piece === 'capstone' ? 'capstone' : 'stone',
        orientation: piece === 'standing' ? 'standing' : 'flat',
      });
    }
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
    aiWorker.postMessage({ id, game, options: { maxDepth: 2, maxNodes: 500 } });
  }

  function countResult() {
    if (!game.result?.winner) return;
    const seat = game.result.winner === firstColor ? 0 : 1;
    scores[seat] = scores[seat]! + winnerScore(game);
  }

  panel.querySelectorAll<HTMLButtonElement>('[data-piece], [data-spread]').forEach(button =>
    button.addEventListener('click', () => {
      piece = (button.dataset.piece ?? 'spread') as typeof piece;
      render();
    }),
  );
  dialog.querySelector('[data-stage]')!.addEventListener('click', () => {
    if (!active || !humanTurn() || draft || spreadGame !== game || !dialog.open) {
      dialog.close();
      spreadGame = null;
      return;
    }
    const dropsText = dialog.querySelector<HTMLInputElement>('#spread-drops')!.value.trim();
    if (!/^[1-8]( +[1-8])*$/.test(dropsText)) {
      dialog.querySelector('.spread-error')!.textContent = 'Enter positive counts separated by spaces.';
      return;
    }
    const move: Move = {
      type: 'spread',
      from,
      direction: dialog.querySelector<HTMLSelectElement>('#spread-direction')!.value as 'north' | 'east' | 'south' | 'west',
      drops: dropsText.split(/ +/).map(Number),
    };
    try {
      draft = { move, game: applyMove(game, move) };
      spreadGame = null;
      dialog.close();
      render();
    } catch (error) {
      dialog.querySelector('.spread-error')!.textContent = error instanceof Error ? error.message : 'Illegal move';
    }
  });

  let press: { id: number; x: number; y: number; multiple: boolean } | null = null;
  options.board.addEventListener('pointerdown', event => {
    if (!active) return;
    if (press) {
      press.multiple = true;
      return;
    }
    if (event.button === 0) press = { id: event.pointerId, x: event.clientX, y: event.clientY, multiple: false };
  });
  window.addEventListener('pointerup', event => {
    if (!press || press.id !== event.pointerId) return;
    const start = press;
    press = null;
    if (active && !start.multiple && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 7 && options.board.contains(event.target as Node)) {
      const index = options.scene.hitTest(event.clientX, event.clientY);
      if (index !== null && index < game.board.size ** 2) activate(index);
    }
  });

  return {
    isActive: () => active,
    activate,
    start(nextMode: 'local' | 'ai', size: number) {
      stopAi();
      active = true;
      mode = nextMode;
      draft = null;
      round = 1;
      scores[0] = scores[1] = 0;
      const forced = new URLSearchParams(location.search).get('human');
      firstColor =
        forced === 'ivory' || forced === 'charcoal'
          ? forced
          : crypto.getRandomValues(new Uint8Array(1))[0]! % 2
            ? 'ivory'
            : 'charcoal';
      piece = 'flat';
      game = createGame(size === 7 ? 5 : size);
      panel.hidden = false;
      options.onActive(true);
      render();
      maybeAi();
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
      dialog.remove();
    },
  };
}
