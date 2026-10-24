import * as THREE from 'three';
import {
  YINSH_COORDS,
  createBoardScene,
  createGameButtons,
  createYinshTopology,
  TAP_MOVE_THRESHOLD,
  DEFAULT_LOBBY_HREF,
  levelToSearchOptions,
  readInitialTheme,
  THEME_STORAGE_KEY,
  YINSH_AI_STRENGTH_STORAGE_KEY,
  yinshWorldPoint,
  type PieceGeometrySet,
  type ThemeId,
  type Topology,
} from '@abstract/three-engine';
import type { AiResponse } from './game/ai.worker';
import { serializeForWorker } from './game/serialize';
import { GameState } from './game/state';
import { gameStateToSnapshot } from './game/snapshot';
import { movesInclude, possibleMoves } from './game/moves';
import { statusLine } from './game/phase';
import { markerIdsOnRingMove, moveNeedsFlip } from './game/visual';
import { coordToIndex, indexToCoord } from './game/cells';
import { chooseAiMove } from './game/ai';
import type { Move } from './game/state';
import type { Player } from './game/player';
import { loadYinshPieceGeometrySet, YINSH_RING_TARGET_OUTER_DIAMETER } from './yinsh-piece-models';

const ringCloseupShot = new URLSearchParams(location.search).get('shot') === 'ring-closeup';

function yinshCloseupTopology(base: Topology, pieceSet: PieceGeometrySet): Topology {
  const ringOuter = YINSH_RING_TARGET_OUTER_DIAMETER / 2;
  const ringHeight = pieceSet.height({ id: 'ring-probe', player: 'A', shape: 'ring' });
  return {
    ...base,
    frameCorners(snapshot) {
      const centerIndex = coordToIndex({ x: 0, y: 0 });
      const center = base.cellPosition(centerIndex, snapshot);
      const pad = ringOuter * 1.65;
      return [
        new THREE.Vector3(center.x - pad, 0, center.z - pad),
        new THREE.Vector3(center.x + pad, ringHeight * 2.5, center.z + pad),
      ];
    },
  };
}

const pieces = await loadYinshPieceGeometrySet();
const topology = ringCloseupShot ? yinshCloseupTopology(createYinshTopology(), pieces) : createYinshTopology();

const board = document.querySelector<HTMLDivElement>('#board')!;
let theme: ThemeId = readInitialTheme();
document.documentElement.dataset.theme = theme;

let humanPlayer: Player = 'A';
let aiPlayer: Player = 'B';
let game = GameState.initial();
let aiPending = false;
let aiGeneration = 0;
let aiWorker: Worker | null = null;
let ringMoveFrom: ReturnType<typeof indexToCoord> | null = null;
let pendingTap: { x: number; y: number } | null = null;

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

const cameraViews = scene.createCameraViews();

const gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  lobbyHref: DEFAULT_LOBBY_HREF,
  cameraViews,
  aiStrengthStorageKey: YINSH_AI_STRENGTH_STORAGE_KEY,
  applyTheme,
  onAiStrengthChange: () => renderStatus(),
  onRestartRound: () => startGame(humanPlayer),
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
      if (localStorage.getItem(THEME_STORAGE_KEY) === null) applyTheme(readInitialTheme());
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

  if (moveNeedsFlip(move) && move.tag === 'MoveRing') {
    const flipIds = markerIdsOnRingMove(game.board, move.start, move.end);
    if (flipIds.length) await scene.flipPieces(flipIds, 80);
  }

  game.performMove(move);
  ringMoveFrom = null;
  syncSnapshot();
  await drainAutoWaits();
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

function syncYinshInteractionPreview(clientX?: number, clientY?: number) {
  if (!humanTurn()) {
    scene.setInteraction({ selection: null, dragging: false, pointer: null, origin: null, target: null, progress: 0 });
    return;
  }
  const pointer = clientX !== undefined && clientY !== undefined ? { x: clientX, y: clientY } : null;
  const target = pointer ? scene.hitTest(pointer.x, pointer.y) : null;
  if (ringMoveFrom) {
    const source = coordToIndex(ringMoveFrom);
    scene.setInteraction({
      selection: { source, count: 1 },
      dragging: false,
      pointer,
      origin: null,
      target,
      progress: 0,
    });
    return;
  }
  scene.setInteraction({ selection: null, dragging: false, pointer, origin: null, target, progress: 0 });
}

async function handleYinshTap(clientX: number, clientY: number) {
  if (!humanTurn()) return;
  const reserve = scene.hitReserve(clientX, clientY);
  if (reserve?.slotId === `hand-${humanPlayer}` && game.turnMode.tag === 'RingPlacement') {
    const cell = scene.hitTest(clientX, clientY);
    if (cell !== null) void humanMove({ tag: 'PlaceRing', coord: indexToCoord(cell) });
    return;
  }
  const cell = scene.hitTest(clientX, clientY);
  if (cell === null) return;
  const coord = indexToCoord(cell);
  const mode = game.turnMode.tag;

  if (mode === 'RingPlacement') {
    void humanMove({ tag: 'PlaceRing', coord });
    return;
  }
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
      gameButtons.setStatus(`${statusLine(game, humanPlayer, gameButtons.aiStrength!.getLevel().label)} · Ring selected — tap destination`);
      syncYinshInteractionPreview(clientX, clientY);
      return;
    }
    void humanMove({ tag: 'MoveRing', start: ringMoveFrom, end: coord });
  }
}

const onPointerDown = ((event: PointerEvent) => {
  if (event.button !== 0 || !humanTurn()) return;
  pendingTap = { x: event.clientX, y: event.clientY };
}) as EventListener;

const onPointerMove = ((event: PointerEvent) => {
  if (!humanTurn()) return;
  syncYinshInteractionPreview(event.clientX, event.clientY);
}) as EventListener;

const onPointerUp = ((event: PointerEvent) => {
  if (event.button !== 0 || !pendingTap) return;
  const start = pendingTap;
  pendingTap = null;
  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MOVE_THRESHOLD) return;
  void handleYinshTap(event.clientX, event.clientY);
}) as EventListener;

stage.addEventListener('pointerdown', onPointerDown, true);
stage.addEventListener('pointermove', onPointerMove, true);
stage.addEventListener('pointerup', onPointerUp, true);

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
  const ringHeight = pieces.height({ id: 'ring-probe', player: 'A', shape: 'ring' });
  focus.y = ringHeight * 0.42;
  scene.setCameraView({ elevationDeg: 35, azimuthDeg: 38, target: focus });
  scene.reframe();
  gameButtons.setStatus('Ring close-up · stone marker in ring');
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
  while (aiPending || scene.animationsBusy()) {
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
