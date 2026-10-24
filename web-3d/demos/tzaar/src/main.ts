import {
  AiWorkerSession,
  aiWatchdogMs,
  createBoardScene,
  createGameButtons,
  createTapInteraction,
  createTzaarHexTopology,
  DEFAULT_LOBBY_HREF,
  levelToSearchOptions,
  readInitialTheme,
  recordAiThinkMetrics,
  TZAAR_AI_STRENGTH_STORAGE_KEY,
  type ThemeId,
} from '@abstract/three-engine';
import { loadTzaarPieceGeometrySet } from './tzaar-piece-models';
import { quickLegalMove } from './game/ai';
import { gameToSnapshot, indexToCoord } from './game/snapshot';
import { GameState, type Coord, type Move, type Player } from './game/state';

const board = document.querySelector<HTMLDivElement>('#board')!;
let theme: ThemeId = readInitialTheme();
document.documentElement.dataset.theme = theme;

let humanPlayer: Player = 'A';
let aiPlayer: Player = 'B';
let game = new GameState();
let aiPending = false;
let aiGeneration = 0;
const aiSession = new AiWorkerSession();

const pieces = await loadTzaarPieceGeometrySet();
const topology = createTzaarHexTopology();

const scene = await createBoardScene(board, {
  gridSize: 9,
  topology,
  pieces,
  initialTheme: theme,
});
const stage = board.querySelector('canvas') ?? board;

function applyTheme(next: ThemeId) {
  theme = next;
  document.documentElement.dataset.theme = theme;
  scene.setTheme(theme);
}

function syncSnapshot() {
  scene.setSnapshot(gameToSnapshot(game));
  board.dataset.ready = 'true';
  renderStatus();
}

function renderStatus(extra?: string) {
  const label = gameButtons.aiStrength!.getLevel().label;
  if (extra) {
    gameButtons.setStatus(extra);
    return;
  }
  if (game.winner) {
    const who = game.winner === humanPlayer ? 'You win!' : 'AI wins.';
    gameButtons.setStatus(`${who} · AI ${label}`);
    return;
  }
  if (aiPending) {
    gameButtons.setStatus(`AI thinking… · ${label}`);
    return;
  }
  if (game.toMove === humanPlayer) {
    gameButtons.setStatus(`Tap your stack, then tap target · AI ${label}`);
  } else {
    gameButtons.setStatus(`AI to move · ${label}`);
  }
}

const cameraViews = scene.createCameraViews();

const gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  lobbyHref: DEFAULT_LOBBY_HREF,
  cameraViews,
  aiStrengthStorageKey: TZAAR_AI_STRENGTH_STORAGE_KEY,
  applyTheme,
  onAiStrengthChange: () => renderStatus(),
  onRestartRound: () => startGame(humanPlayer),
  firstPlayer: {
    title: 'Who plays white?',
    description: 'You vs AI — pick your color.',
    choices: [
      { label: 'You · White (A)', id: 'A', testId: 'first-white' },
      { label: 'You · Black (B)', id: 'B', testId: 'first-black' },
    ],
    onSelect: id => startGame(id as Player),
  },
});

function stopAi() {
  aiGeneration++;
  aiSession.cancel();
  aiPending = false;
}

function startGame(human: Player) {
  stopAi();
  humanPlayer = human;
  aiPlayer = human === 'A' ? 'B' : 'A';
  game = new GameState();
  syncSnapshot();
  maybeAiTurn();
}

function humanTurn() {
  return !game.winner && game.toMove === humanPlayer && !aiPending;
}

function coordFromIndex(index: number): Coord {
  return indexToCoord(index);
}

function stackOwnedByHuman(c: Coord) {
  const s = game.board.stack(c);
  return !!s && s.owner === humanPlayer;
}

async function performMove(move: Move) {
  if (!game.apply(move)) return;
  syncSnapshot();
}

async function humanMove(move: Move) {
  if (!humanTurn()) return;
  await scene.enqueueAnimation(async () => {
    await performMove(move);
    renderStatus();
    maybeAiTurn();
  });
}

async function runAiTurn() {
  if (game.winner || game.toMove !== aiPlayer || aiPending) return;
  aiPending = true;
  renderStatus();
  const gen = ++aiGeneration;
  const search = levelToSearchOptions(gameButtons.aiStrength!.getLevel());
  document.body.dataset.lastAiWatchdogMs = String(aiWatchdogMs(search.maxTimeMs));
  const t0 = performance.now();
  const move = await aiSession.request<Move | null>({
    createWorker: () => new Worker(new URL('./game/ai.worker.ts', import.meta.url), { type: 'module' }),
    postMessage: (worker, id) =>
      worker.postMessage({
        id,
        game,
        maxDepth: search.maxDepth,
        maxNodes: search.maxNodes,
        timeBudgetMs: search.maxTimeMs,
      }),
    parseMessage: (event, id) => {
      const data = event.data as { id: number; move: Move | null };
      if (data.id !== id) return undefined;
      return data.move;
    },
    timeBudgetMs: search.maxTimeMs,
  });
  recordAiThinkMetrics(performance.now() - t0);
  if (gen !== aiGeneration) return;
  const resolved = move ?? quickLegalMove(game);
  await scene.enqueueAnimation(async () => {
    if (resolved) await performMove(resolved);
    aiPending = false;
    renderStatus(resolved ? undefined : 'AI could not move');
    maybeAiTurn();
  });
}

function maybeAiTurn() {
  if (game.winner || game.toMove !== aiPlayer || aiPending) return;
  void runAiTurn();
}

createTapInteraction({
  element: stage as HTMLElement,
  getSnapshot: () => gameToSnapshot(game),
  canInteract: () => humanTurn(),
  getPickHeight(cell) {
    if (!humanTurn()) return 0;
    const c = coordFromIndex(cell);
    return stackOwnedByHuman(c) ? 1 : 0;
  },
  hitTest: (x, y) => (humanTurn() ? scene.hitTest(x, y) : null),
  onView: view => scene.setInteraction(view),
  onCommit: (selection, target) => {
    if (typeof selection.source !== 'number') return;
    const from = coordFromIndex(selection.source);
    const to = coordFromIndex(target);
    void humanMove({ tag: 'Action', from, to });
  },
});

syncSnapshot();

if (new URLSearchParams(location.search).has('e2e')) startGame('A');

declare global {
  interface Window {
    __tzaarE2e?: {
      humanTurn: () => boolean;
      aiPending: () => boolean;
      firstLegalMove: () => Move | null;
      applyMove: (move: Move) => void;
      waitForSettled: () => Promise<void>;
    };
  }
}

if (new URLSearchParams(location.search).has('e2e')) {
  window.__tzaarE2e = {
    humanTurn: () => humanTurn(),
    aiPending: () => aiPending,
    firstLegalMove: () => game.legalMoves()[0] ?? null,
    applyMove: (move: Move) => humanMove(move),
    waitForSettled: async () => {
      while (aiPending || scene.animationsBusy()) {
        await new Promise<void>(r => requestAnimationFrame(() => r()));
      }
      await scene.drainAnimations();
    },
  };
}

export { scene, game };
