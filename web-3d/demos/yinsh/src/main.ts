import * as THREE from 'three';
import {
  YINSH,
  YINSH_COORDS,
  createBoardScene,
  createGameButtons,
  createInteraction,
  createYinshMarkerGeometry,
  createYinshRingGeometry,
  createYinshTopology,
  DEFAULT_LOBBY_HREF,
  levelToSearchOptions,
  readStoredTheme,
  THEME_STORAGE_KEY,
  YINSH_AI_STRENGTH_STORAGE_KEY,
  playWinSoundAfterPlace,
  yinshPieceGeometrySet,
  yinshWorldPoint,
  type ReservePick,
  type ThemeId,
  type Topology,
} from '@abstract/three-engine';
import type { AiResponse } from './game/ai.worker';
import { serializeForWorker } from './game/serialize';
import { GameState } from './game/state';
import { gameStateToSnapshot } from './game/snapshot';
import { movesInclude, possibleMoves } from './game/moves';
import { phaseLabel, statusLine } from './game/phase';
import { markerIdsOnRingMove, moveNeedsFlip } from './game/visual';
import { coordToIndex, indexToCoord } from './game/cells';
import { chooseAiMove } from './game/ai';
import type { Move } from './game/state';
import type { Player } from './game/player';

const ringCloseupShot = new URLSearchParams(location.search).get('shot') === 'ring-closeup';

function yinshCloseupTopology(base: Topology): Topology {
  return {
    ...base,
    frameCorners(snapshot) {
      const centerIndex = coordToIndex({ x: 0, y: 0 });
      const center = base.cellPosition(centerIndex, snapshot);
      const pad = YINSH.RING_OUTER * 1.65;
      return [
        new THREE.Vector3(center.x - pad, 0, center.z - pad),
        new THREE.Vector3(center.x + pad, YINSH.RING_HEIGHT * 2.5, center.z + pad),
      ];
    },
  };
}

const topology = ringCloseupShot ? yinshCloseupTopology(createYinshTopology()) : createYinshTopology();
const ringGeo = createYinshRingGeometry();
const markerGeo = createYinshMarkerGeometry();
const pieces = yinshPieceGeometrySet(ringGeo, markerGeo);

const board = document.querySelector<HTMLDivElement>('#board')!;
let theme: ThemeId = readStoredTheme();
document.documentElement.dataset.theme = theme;

let humanPlayer: Player = 'A';
let aiPlayer: Player = 'B';
let game = GameState.initial();
let aiPending = false;
let aiGeneration = 0;
let aiWorker: Worker | null = null;
let ringMoveFrom: ReturnType<typeof indexToCoord> | null = null;
let lastDragging = false;

const scene = await createBoardScene(board, {
  gridSize: 11,
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
  scene.setSnapshot(gameStateToSnapshot(game));
  renderStatus();
}

function renderStatus(extra?: string) {
  const label = gameButtons.aiStrength!.getLevel().label;
  gameButtons.setStatus(statusLine(game, humanPlayer, label, extra));
}

const gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  lobbyHref: DEFAULT_LOBBY_HREF,
  aiStrengthStorageKey: YINSH_AI_STRENGTH_STORAGE_KEY,
  applyTheme,
  onAiStrengthChange: () => renderStatus(),
  firstPlayer: {
    title: 'Who plays white rings?',
    description: 'You vs AI — pick your color.',
    choices: [
      { label: 'You · White (A)', id: 'A', testId: 'first-white' },
      { label: 'You · Black (B)', id: 'B', testId: 'first-black' },
    ],
    onSelect: id => startGame(id as Player),
  },
});

try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    try {
      if (localStorage.getItem(THEME_STORAGE_KEY) === null) applyTheme(readStoredTheme());
    } catch {
      /* ignore */
    }
  });
} catch {
  /* ignore */
}

function startGame(human: Player) {
  stopAi();
  humanPlayer = human;
  aiPlayer = human === 'A' ? 'B' : 'A';
  game = GameState.initial();
  ringMoveFrom = null;
  syncSnapshot();
  void drainAutoWaits().then(() => maybeAiTurn());
}

function humanTurn() {
  return !game.winner() && game.activePlayer === humanPlayer && !aiPending;
}

function stopAi() {
  aiGeneration++;
  aiWorker?.terminate();
  aiWorker = null;
  aiPending = false;
}

async function performMove(move: Move): Promise<void> {
  if (!movesInclude(possibleMoves(game), move)) return;

  const pointsBefore = { a: game.pointsA, b: game.pointsB };
  const hadWinner = game.winner();

  if (moveNeedsFlip(move) && move.tag === 'MoveRing') {
    const flipIds = markerIdsOnRingMove(game.board, move.start, move.end);
    if (flipIds.length) await scene.flipPieces(flipIds, 80);
  }

  game.performMove(move);
  ringMoveFrom = null;
  syncSnapshot();
  await drainAutoWaits();
  await scene.drainAnimations();

  const scored =
    move.tag === 'RemoveRun' ||
    game.pointsA > pointsBefore.a ||
    game.pointsB > pointsBefore.b;
  const won = !hadWinner && !!game.winner();
  if (scored || won) playWinSoundAfterPlace();
}

async function drainAutoWaits(): Promise<void> {
  for (;;) {
    const waits = possibleMoves(game);
    if (waits.length !== 1 || waits[0]!.tag !== 'Wait') break;
    game.performMove({ tag: 'Wait' });
    syncSnapshot();
  }
}

async function runAiTurn(): Promise<void> {
  if (game.winner() || game.activePlayer !== aiPlayer) return;
  aiPending = true;
  renderStatus();
  const gen = ++aiGeneration;
  const depth = levelToSearchOptions(gameButtons.aiStrength!.getLevel()).maxDepth;
  document.body.dataset.yinshAiDepth = String(depth);

  aiWorker = new Worker(new URL('./game/ai.worker.ts', import.meta.url), { type: 'module' });
  aiWorker.onmessage = (event: MessageEvent<AiResponse>) => {
    if (event.data.id !== gen || gen !== aiGeneration) return;
    aiWorker?.terminate();
    aiWorker = null;
    const move = event.data.move;
    void scene.enqueueAnimation(async () => {
      const applied =
        move ??
        (() => {
          try {
            return chooseAiMove(game, 2);
          } catch {
            return null;
          }
        })();
      if (applied) await performMove(applied);
      renderStatus();
      aiPending = false;
      maybeAiTurn();
    });
  };
  aiWorker.postMessage({ id: gen, state: serializeForWorker(game), maxDepth: depth });
}

function maybeAiTurn() {
  if (game.winner() || game.activePlayer !== aiPlayer || aiPending) return;
  void runAiTurn();
}

async function humanMove(move: Move) {
  if (!humanTurn()) return;
  await scene.enqueueAnimation(async () => {
    await performMove(move);
    renderStatus();
    maybeAiTurn();
  });
}

function reserveForHand(player: Player): ReservePick | null {
  const snap = gameStateToSnapshot(game);
  const slot = snap.reserves?.find(r => r.id === `hand-${player}`);
  if (!slot || slot.count <= 0) return null;
  return { player: slot.player, shape: 'ring', slotId: slot.id, pile: slot.pile };
}

createInteraction({
  element: stage as HTMLElement,
  getSnapshot: () => gameStateToSnapshot(game),
  canInteract: () => humanTurn(),
  hitTest: (x, y) => (humanTurn() ? scene.hitTest(x, y) : null),
  hitReserve: (x, y) => {
    if (!humanTurn() || game.turnMode.tag !== 'RingPlacement') return null;
    const pick = scene.hitReserve(x, y);
    if (!pick) return null;
    if (pick.slotId === `hand-${humanPlayer}`) return pick;
    return null;
  },
  onView: view => {
    scene.setInteraction(view);
    lastDragging = view.dragging;
  },
  onCommit: (selection, target) => {
    if (typeof target !== 'number') return;
    const coord = indexToCoord(target);

    if (typeof selection.source !== 'number') {
      const reserve = selection.source as ReservePick;
      if (reserve.slotId === `hand-${humanPlayer}` && game.turnMode.tag === 'RingPlacement') {
        void humanMove({ tag: 'PlaceRing', coord });
      }
      return;
    }

    const from = indexToCoord(selection.source);
    const mode = game.turnMode.tag;

    if (mode === 'MarkerPlacement') {
      void humanMove({ tag: 'PlaceMarker', coord: from });
      return;
    }
    if (mode === 'RingMovement' && game.turnMode.tag === 'RingMovement') {
      void humanMove({ tag: 'MoveRing', start: game.turnMode.start, end: coord });
      return;
    }
    if (mode === 'RunRemoval') {
      void humanMove({ tag: 'RemoveRun', coord });
      return;
    }
    if (mode === 'RingRemoval') {
      void humanMove({ tag: 'RemoveRing', coord: from });
    }
  },
});

stage.addEventListener(
  'click',
  event => {
    if (!humanTurn() || lastDragging) return;
    const cell = scene.hitTest((event as MouseEvent).clientX, (event as MouseEvent).clientY);
    if (cell === null) return;
    const coord = indexToCoord(cell);
    const mode = game.turnMode.tag;

    if (mode === 'MarkerPlacement') {
      void humanMove({ tag: 'PlaceMarker', coord });
      return;
    }
    if (mode === 'RunRemoval') {
      void humanMove({ tag: 'RemoveRun', coord });
      return;
    }
    if (mode === 'RingRemoval') {
      void humanMove({ tag: 'RemoveRing', coord });
      return;
    }
    if (mode === 'RingMovement') {
      if (!ringMoveFrom) {
        ringMoveFrom = coord;
        gameButtons.setStatus(`${statusLine(game, humanPlayer, gameButtons.aiStrength!.getLevel().label)} · Ring selected`);
        return;
      }
      void humanMove({ tag: 'MoveRing', start: ringMoveFrom, end: coord });
    }
  },
  true,
);

function loadRingCloseupShot() {
  const idx = coordToIndex({ x: 0, y: 0 });
  const cells = Array.from({ length: YINSH_COORDS.length }, () => [] as import('@abstract/three-engine').EnginePiece[]);
  cells[idx] = [
    { id: 'ring-B-0,0', player: 'B', shape: 'ring' },
    { id: 'marker-A-0,0', player: 'A', shape: 'marker' },
  ];
  scene.setSnapshot({
    playableCells: YINSH_COORDS.length,
    cellCount: YINSH_COORDS.length,
    cells,
    reserves: [],
  });
  const focus = yinshWorldPoint({ x: 0, y: 0 });
  focus.y = YINSH.RING_HEIGHT * 0.42;
  scene.setCameraView({ elevationDeg: 35, azimuthDeg: 38, target: focus });
  scene.reframe();
  gameButtons.setStatus('Ring close-up · GIPF marker in hole');
  document.body.dataset.shotMode = 'ring-closeup';
}

const urlParams = new URLSearchParams(location.search);

if (urlParams.get('shot') === 'ring-closeup') {
  loadRingCloseupShot();
} else if (!urlParams.has('e2e')) {
  startGame('A');
}

async function waitForSettled(timeoutMs = 20_000): Promise<void> {
  const start = performance.now();
  while (aiPending) {
    if (performance.now() - start > timeoutMs) throw new Error('AI timeout');
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  await scene.drainAnimations();
}

function pickPriorityMove(moves: Move[]): Move | null {
  if (!moves.length) return null;
  const rank = (m: Move) => {
    switch (m.tag) {
      case 'RemoveRing':
        return 0;
      case 'RemoveRun':
        return 1;
      case 'MoveRing':
        return 2;
      case 'PlaceMarker':
        return 3;
      case 'PlaceRing':
        return 4;
      default:
        return 9;
    }
  };
  return [...moves].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

function suggestHumanMove(): Move | null {
  if (!humanTurn()) return null;
  const all = possibleMoves(game);
  const pool = all.filter(m => m.tag !== 'Wait');
  return pickPriorityMove(pool.length ? pool : all);
}

function drainAutoWaitsSync() {
  for (;;) {
    const waits = possibleMoves(game);
    if (waits.length !== 1 || waits[0]!.tag !== 'Wait') break;
    game.performMove({ tag: 'Wait' });
  }
}

function engineStep(): boolean {
  if (game.winner()) return true;
  drainAutoWaitsSync();
  const moves = possibleMoves(game).filter(m => m.tag !== 'Wait');
  const pick = pickPriorityMove(moves);
  if (!pick) return !!game.winner();
  game.performMove(pick);
  drainAutoWaitsSync();
  return !!game.winner();
}

function finishGameEngine(maxSteps = 5000): Player | undefined {
  stopAi();
  for (let i = 0; i < maxSteps; i++) {
    if (engineStep()) break;
  }
  syncSnapshot();
  return game.winner();
}

if (urlParams.has('e2e')) {
  startGame('A');
  (window as unknown as { __yinshE2e?: Record<string, unknown> }).__yinshE2e = {
    winner: () => game.winner(),
    humanTurn: () => humanTurn(),
    aiPending: () => aiPending,
    turnMode: () => game.turnMode.tag,
    suggestMove: () => suggestHumanMove(),
    applyMove: (move: Move) => humanMove(move),
    waitForSettled,
    finishGameEngine,
    pointsA: () => game.pointsA,
    pointsB: () => game.pointsB,
  };
}

export { scene, game, humanPlayer };
