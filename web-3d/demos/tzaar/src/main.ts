import {
  createBoardScene,
  createGameButtons,
  createTapInteraction,
  createTzaarHexTopology,
  DEFAULT_LOBBY_HREF,
  levelToSearchOptions,
  readInitialTheme,
  TZAAR_AI_STRENGTH_STORAGE_KEY,
  type ThemeId,
} from '@abstract/three-engine';
import { loadTzaarPieceGeometrySet } from './tzaar-piece-models';
import { chooseAiMove } from './game/ai';
import { gameToSnapshot, indexToCoord } from './game/snapshot';
import { GameState, type Coord, type Move, type Player } from './game/state';

const board = document.querySelector<HTMLDivElement>('#board')!;
let theme: ThemeId = readInitialTheme();
document.documentElement.dataset.theme = theme;

let humanPlayer: Player = 'A';
let aiPlayer: Player = 'B';
let game = new GameState();
let aiPending = false;

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

function startGame(human: Player) {
  humanPlayer = human;
  aiPlayer = human === 'A' ? 'B' : 'A';
  game = new GameState();
  aiPending = false;
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
  if (game.winner || game.toMove !== aiPlayer) return;
  aiPending = true;
  renderStatus();
  await new Promise(r => setTimeout(r, 120));
  const move = chooseAiMove(game);
  await scene.enqueueAnimation(async () => {
    if (move) await performMove(move);
    aiPending = false;
    renderStatus();
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
