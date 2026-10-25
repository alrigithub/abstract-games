import {
  AiWorkerSession,
  aiWatchdogMs,
  createBoardScene,
  createGameButtons,
  createTapInteraction,
  createTzaarHexTopology,
  DEFAULT_LOBBY_HREF,
  levelToSearchOptions,
  applyDocumentTheme,
  motionDelay,
  prefersReducedMotion,
  readInitialTheme,
  recordAiThinkMetrics,
  TZAAR_AI_STRENGTH_STORAGE_KEY,
  createLoadingScreen,
  setActiveLoadingScreen,
  type InteractionView,
  type ThemeId,
} from '@abstract/three-engine';
import { loadTzaarPieceGeometrySet } from './tzaar-piece-models';
import { quickLegalMove } from './game/ai';
import {
  classifyMove,
  planActionCues,
  playCueSequence,
  TZAAR_ANIM,
  type Actor,
} from './game/move-animation';
import { coordToIndex, gameToSnapshot, indexToCoord } from './game/snapshot';
import { GameState, serializeForAiWorker, type Coord, type Move, type Player } from './game/state';
import { createStackHeightLabels } from './stack-labels';

const loading = createLoadingScreen({ gameName: 'Tzaar' });
setActiveLoadingScreen(loading);

const board = document.querySelector<HTMLDivElement>('#board')!;
const toast = document.querySelector<HTMLDivElement>('#tzaar-toast')!;
let theme: ThemeId = readInitialTheme();
applyDocumentTheme(theme);

let humanPlayer: Player = 'A';
let aiPlayer: Player = 'B';
let game = new GameState();
let aiPending = false;
let inputLocked = false;
let aiGeneration = 0;
const aiSession = new AiWorkerSession();
let toastTimer = 0;
let lastAiFromTo: { from: Coord; to: Coord } | null = null;

const pieces = await loading.track(loadTzaarPieceGeometrySet(), 'Loading Tzaar piece models');
const topology = createTzaarHexTopology();

const scene = await loading.track(
  createBoardScene(board, {
    gridSize: 9,
    topology,
    pieces,
    initialTheme: theme,
    stackedPiecesReceiveShadow: true,
  }),
  'Starting board scene (WebGL + audio)',
);
const stage = board.querySelector('canvas') ?? board;
const stackLabels = createStackHeightLabels(board, scene);

const EMPTY_VIEW: InteractionView = {
  selection: null,
  dragging: false,
  pointer: null,
  origin: null,
  target: null,
  progress: 0,
};

function applyTheme(next: ThemeId) {
  theme = next;
  applyDocumentTheme(theme);
  scene.setTheme(theme);
}

function syncSnapshot(options?: Parameters<typeof scene.setSnapshot>[1]) {
  scene.setSnapshot(gameToSnapshot(game), options);
  board.dataset.ready = 'true';
  stackLabels.sync(game);
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

function showToast(text: string, ms = TZAAR_ANIM.PASS_TOAST_MS) {
  toast.hidden = false;
  toast.textContent = text;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, prefersReducedMotion() ? 0 : ms);
}

function hideToast() {
  window.clearTimeout(toastTimer);
  toast.hidden = true;
}

function clearAssist() {
  lastAiFromTo = null;
  scene.setBoardAssist(null);
  scene.setInteraction(EMPTY_VIEW);
}

const HALO_RADIUS = 0.48;

function highlightCells(cells: number[], last?: { from: Coord; to: Coord }) {
  const valid = cells.filter(index => index >= 0);
  scene.setBoardAssist({
    destinationCells: valid,
    destinationDotRadius: HALO_RADIUS,
    shadows: valid.map(cell => ({
      cell,
      footprint: { shape: 'ring', outerRadius: 0.46, innerRadius: 0.36 },
      strength: 'hover',
    })),
    lastMove: last
      ? { fromCell: coordToIndex(last.from), toCell: coordToIndex(last.to) }
      : undefined,
  });
}

function showLastAiMove(from: Coord, to: Coord) {
  lastAiFromTo = { from, to };
  highlightCells([coordToIndex(from), coordToIndex(to)], { from, to });
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
  inputLocked = false;
  hideToast();
  clearAssist();
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
  return !game.winner && game.toMove === humanPlayer && !aiPending && !inputLocked && !scene.animationsBusy();
}

function coordFromIndex(index: number): Coord {
  return indexToCoord(index);
}

function stackOwnedByHuman(c: Coord) {
  const s = game.board.stack(c);
  return !!s && s.owner === humanPlayer;
}

async function playAnimatedMove(move: Move, actor: Actor) {
  const reduced = prefersReducedMotion();
  const kind = classifyMove(game, move);
  const from = move.tag === 'Action' ? move.from : undefined;
  const to = move.tag === 'Action' ? move.to : undefined;
  const moving = from ? game.board.stack(from) : null;
  const capturedIds = kind === 'capture' && to ? (game.board.stack(to)?.pieces.map(piece => piece.id) ?? []) : [];
  const movingHeight = moving?.height ?? 1;
  const destHeight = to ? (game.board.stack(to)?.height ?? 0) : 0;
  const stackedHeight = kind === 'stack' ? destHeight + movingHeight : movingHeight;
  const flyingId = moving?.pieces[moving.pieces.length - 1]?.id;

  const cues = planActionCues({
    actor,
    reducedMotion: reduced,
    includeThink: false,
    action: { kind, from, to, stackedHeight },
  });

  board.dataset.animating = 'true';
  try {
    await playCueSequence(cues, {
      delay: ms => motionDelay(ms, reduced),
      highlightSource(source) {
        board.dataset.animCue = 'highlight';
        highlightCells([coordToIndex(source)], lastAiFromTo ?? undefined);
      },
      lift(source) {
        board.dataset.animCue = 'lift';
        const count = game.board.stack(source)?.height ?? 1;
        const index = coordToIndex(source);
        scene.setInteraction({
          selection: { source: index, count },
          dragging: false,
          pointer: null,
          origin: null,
          target: index,
          progress: 0,
        });
      },
      async glide(cue) {
        board.dataset.animCue = cue.kind === 'stack' ? 'stack-glide' : 'glide';
        if (!game.apply(move)) {
          scene.setInteraction(EMPTY_VIEW);
          syncSnapshot();
          return;
        }
        const hide = new Set<string>();
        if (cue.kind === 'stack') hide.add(stackLabels.hideCell(cue.to));
        if (cue.kind === 'capture') hide.add(stackLabels.hideCell(cue.to));
        highlightCells([coordToIndex(cue.from), coordToIndex(cue.to)], { from: cue.from, to: cue.to });
        scene.setSnapshot(gameToSnapshot(game), {
          durationMs: cue.ms,
          lift: reduced ? 0 : TZAAR_ANIM.LIFT,
          departing:
            cue.kind === 'capture' && capturedIds.length
              ? { ids: capturedIds, durationMs: reduced ? 0 : TZAAR_ANIM.CAPTURE_FADE_MS, sink: TZAAR_ANIM.LIFT }
              : undefined,
        });
        scene.setInteraction(EMPTY_VIEW);
        stackLabels.sync(game, {
          hide,
          flying: flyingId ? { pieceId: flyingId, height: cue.kind === 'stack' ? movingHeight : stackedHeight } : undefined,
        });
        await motionDelay(Math.max(cue.ms, cue.kind === 'capture' ? TZAAR_ANIM.CAPTURE_FADE_MS : 0), reduced);
        if (!reduced) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      },
      captureDepart() {
        /* Departing ids are applied with the glide snapshot. */
      },
      land() {
        board.dataset.animCue = 'land';
        scene.setInteraction(EMPTY_VIEW);
        stackLabels.sync(game);
      },
      passToast() {
        board.dataset.animCue = 'pass';
        if (!game.apply(move)) {
          syncSnapshot();
          return;
        }
        syncSnapshot();
        if (actor === 'ai') {
          showToast('AI passes');
          gameButtons.setStatus('AI passes');
        }
      },
      lastMove() {
        /* Turn-level last-move highlight is applied after the AI turn. */
      },
    });
  } finally {
    board.dataset.animating = 'false';
    delete board.dataset.animCue;
  }
}

async function humanMove(move: Move) {
  if (!humanTurn()) return;
  inputLocked = true;
  clearAssist();
  try {
    await scene.enqueueAnimation(async () => {
      await playAnimatedMove(move, 'human');
      renderStatus();
      maybeAiTurn();
    });
  } finally {
    inputLocked = false;
  }
}

async function requestAiMove(): Promise<Move | null> {
  const search = levelToSearchOptions(gameButtons.aiStrength!.getLevel());
  document.body.dataset.lastAiWatchdogMs = String(aiWatchdogMs(search.maxTimeMs));
  const t0 = performance.now();
  const move = await aiSession.request<Move | null>({
    createWorker: () => new Worker(new URL('./game/ai.worker.ts', import.meta.url), { type: 'module' }),
    postMessage: (worker, id) =>
      worker.postMessage({
        id,
        state: serializeForAiWorker(game),
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
  return move ?? quickLegalMove(game);
}

async function runAiTurn() {
  if (game.winner || game.toMove !== aiPlayer || aiPending) return;
  aiPending = true;
  inputLocked = true;
  renderStatus();
  const gen = ++aiGeneration;
  const reduced = prefersReducedMotion();
  let lastAction: { from: Coord; to: Coord } | null = null;
  try {
    while (!game.winner && game.toMove === aiPlayer && gen === aiGeneration) {
      await motionDelay(TZAAR_ANIM.AI_THINK_MS, reduced);
      if (gen !== aiGeneration) return;
      const resolved = await requestAiMove();
      if (gen !== aiGeneration) return;
      if (!resolved) {
        renderStatus('AI could not move');
        break;
      }
      if (resolved.tag === 'Action') lastAction = { from: resolved.from, to: resolved.to };
      await scene.enqueueAnimation(async () => {
        if (gen !== aiGeneration) return;
        await playAnimatedMove(resolved, 'ai');
      });
      if (gen !== aiGeneration) return;
      if (game.toMove === aiPlayer && !game.winner) {
        await motionDelay(TZAAR_ANIM.BETWEEN_ACTIONS_MS, reduced);
      }
    }
    if (gen === aiGeneration && lastAction) showLastAiMove(lastAction.from, lastAction.to);
  } finally {
    if (gen === aiGeneration) {
      aiPending = false;
      inputLocked = false;
      renderStatus();
    }
  }
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

await loading.done();
setActiveLoadingScreen(null);

if (new URLSearchParams(location.search).has('e2e')) startGame('A');

declare global {
  interface Window {
    __tzaarE2e?: {
      humanTurn: () => boolean;
      aiPending: () => boolean;
      firstLegalMove: () => Move | null;
      applyMove: (move: Move) => void;
      animState: () => { animating: boolean; cue: string; aiPending: boolean; inputLocked: boolean };
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
    animState: () => ({
      animating: board.dataset.animating === 'true',
      cue: board.dataset.animCue ?? '',
      aiPending,
      inputLocked,
    }),
    waitForSettled: async () => {
      while (aiPending || inputLocked || scene.animationsBusy()) {
        await new Promise<void>(r => requestAnimationFrame(() => r()));
      }
      await scene.drainAnimations();
    },
  };
}

export { scene, game };
