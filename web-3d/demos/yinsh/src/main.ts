import * as THREE from 'three';
import {
  YINSH_COORDS,
  createBoardScene,
  createGameButtons,
  createYinshTopology,
  DEFAULT_LOBBY_HREF,
  AiWorkerSession,
  levelToSearchOptions,
  readInitialTheme,
  recordAiThinkMetrics,
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
import {
  applyRingLandingToPathWorld,
  buildAiMovePathCells,
  buildAiMovePathWorld,
  ringPieceId,
  type AiMoveHighlight,
} from './game/ai-move-highlight';
import { buildYinshAssist } from './game/move-hints';
import { coordToIndex, indexToCoord } from './game/cells';
import { coordEq, coordKey, type Coord } from './game/coord';
import { quickLegalMove } from './game/ai';
import type { Move } from './game/state';
import type { Player } from './game/player';
import { loadYinshPieceGeometrySet, YINSH_RING_TARGET_OUTER_DIAMETER } from './yinsh-piece-models';

/** Match engine tap vs drag threshold. */
const TAP_MOVE_THRESHOLD = 8;

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
const aiSession = new AiWorkerSession();
let ringMoveFrom: Coord | null = null;
let pendingTap: { x: number; y: number } | null = null;
let hoverCellIndex: number | null = null;
let lastAiMoveHighlight: AiMoveHighlight | null = null;

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

function activeRingMoveStart(): Coord | null {
  if (game.turnMode.tag === 'RingMovement') return ringMoveFrom ?? game.turnMode.start;
  return ringMoveFrom;
}

function refreshMoveHints(clientX?: number, clientY?: number) {
  if (clientX !== undefined && clientY !== undefined) {
    hoverCellIndex = humanTurn() ? scene.hitTest(clientX, clientY) : null;
  }
  const assist = buildYinshAssist(game, {
    humanPlayer,
    humanTurn: humanTurn(),
    ringMoveStart: activeRingMoveStart(),
    hoverCell: hoverCellIndex,
    lastAiMove: lastAiMoveHighlight,
  });
  scene.setBoardAssist(assist);
  scene.setFlipPreview(assist?.flipPieceIds ?? []);
}

function syncSnapshot() {
  scene.setSnapshot(gameStateToSnapshot(game));
  if (game.turnMode.tag === 'RingMovement' && !ringMoveFrom) {
    ringMoveFrom = game.turnMode.start;
  }
  refreshMoveHints();
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
  aiSession.cancel();
  aiPending = false;
}

async function performMove(move: Move, fromAi = false): Promise<void> {
  if (!movesInclude(possibleMoves(game), move)) return;
  clearPieceInteraction();
  if (move.tag !== 'Wait') lastAiMoveHighlight = null;

  if (moveNeedsFlip(move) && move.tag === 'MoveRing') {
    const flipIds = markerIdsOnRingMove(game.board, move.start, move.end);
    if (flipIds.length) await scene.flipPieces(flipIds, 80);
  }

  const aiRingMove = fromAi && move.tag === 'MoveRing' ? move : null;
  const aiFlipIds =
    aiRingMove ? markerIdsOnRingMove(game.board, aiRingMove.start, aiRingMove.end) : [];

  game.performMove(move);
  ringMoveFrom = null;
  syncSnapshot();

  if (aiRingMove) {
    const pathCells = buildAiMovePathCells(aiRingMove.start, aiRingMove.end);
    const pathWorld = buildAiMovePathWorld(aiRingMove.start, aiRingMove.end);
    const ringPos = scene.getPieceWorldPosition(ringPieceId(aiPlayer, aiRingMove.end));
    lastAiMoveHighlight = {
      fromCell: coordToIndex(aiRingMove.start),
      toCell: coordToIndex(aiRingMove.end),
      pathCells,
      pathWorld: applyRingLandingToPathWorld(pathWorld, ringPos ? { x: ringPos.x, z: ringPos.z } : null),
      flipPieceIds: aiFlipIds,
    };
    refreshMoveHints();
  }

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
  if (game.winner() || game.activePlayer !== aiPlayer || aiPending) return;
  aiPending = true;
  renderStatus();
  const gen = ++aiGeneration;
  const search = levelToSearchOptions(gameButtons.aiStrength!.getLevel());
  document.body.dataset.yinshAiDepth = String(search.maxDepth);

  const t0 = performance.now();
  const move = await aiSession.request<Move | null>({
    createWorker: () => new Worker(new URL('./game/ai.worker.ts', import.meta.url), { type: 'module' }),
    postMessage: (worker, id) =>
      worker.postMessage({
        id,
        state: serializeForWorker(game),
        maxDepth: search.maxDepth,
        maxNodes: search.maxNodes,
        timeBudgetMs: search.maxTimeMs,
      }),
    parseMessage: (event, id) => {
      const data = event.data as AiResponse;
      if (data.id !== id) return undefined;
      return data.move;
    },
    timeBudgetMs: search.maxTimeMs,
  });
  recordAiThinkMetrics(performance.now() - t0);
  if (gen !== aiGeneration) return;

  void scene.enqueueAnimation(async () => {
    const applied = move ?? quickLegalMove(game);
    if (applied) await performMove(applied, true);
    renderStatus(applied ? undefined : 'AI could not move');
    aiPending = false;
    maybeAiTurn();
  });
}

function maybeAiTurn() {
  if (game.winner() || game.activePlayer !== aiPlayer || aiPending) return;
  void runAiTurn();
}

function clearPieceInteraction(pointer: { x: number; y: number } | null = null) {
  scene.setInteraction({
    selection: null,
    dragging: false,
    pointer,
    origin: null,
    target: pointer ? scene.hitTest(pointer.x, pointer.y) : null,
    progress: 0,
  });
}

async function humanMove(move: Move) {
  if (!humanTurn()) return;
  clearPieceInteraction();
  await scene.enqueueAnimation(async () => {
    clearPieceInteraction();
    await performMove(move);
    clearPieceInteraction();
    renderStatus();
    maybeAiTurn();
  });
}

/** Yinsh previews use board assist only — never lift rings/markers via selection. */
function syncYinshInteractionPreview(clientX?: number, clientY?: number) {
  refreshMoveHints(clientX, clientY);
  const pointer =
    clientX !== undefined && clientY !== undefined && humanTurn() ? { x: clientX, y: clientY } : null;
  clearPieceInteraction(pointer);
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
  if (mode === 'RingMovement' && game.turnMode.tag === 'RingMovement') {
    const start = game.turnMode.start;
    void humanMove({ tag: 'MoveRing', start, end: coord });
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

function loadAssistRingMoveShot() {
  stopAi();
  humanPlayer = 'A';
  aiPlayer = 'B';
  game = GameState.initial();
  game.board.addRing('A', { x: 0, y: 0 });
  game.board.addRing('B', { x: 2, y: -2 });
  game.board.addMarker('A', { x: 0, y: 0 });
  game.board.addMarker('B', { x: 0, y: -1 });
  game.board.addMarker('B', { x: 0, y: -2 });
  game.activePlayer = 'A';
  game.turnMode = { tag: 'RingMovement', start: { x: 0, y: 0 } };
  ringMoveFrom = { x: 0, y: 0 };
  syncSnapshot();
  syncYinshInteractionPreview();
  const focus = yinshWorldPoint({ x: 0, y: -1 });
  focus.y = pieces.height({ id: 'ring-probe', player: 'A', shape: 'ring' }) * 0.35;
  scene.setCameraView({ elevationDeg: 38, azimuthDeg: 25, target: focus });
  scene.reframe();
  gameButtons.setStatus('Move assist · ring destinations');
}

function loadAssistPathFlipShot() {
  loadAssistRingMoveShot();
  hoverCellIndex = coordToIndex({ x: 0, y: -3 });
  refreshMoveHints();
  syncYinshInteractionPreview();
  gameButtons.setStatus('Move assist · path and flip preview');
}

function loadAssistRunPickShot() {
  stopAi();
  humanPlayer = 'A';
  game = GameState.initial();
  for (let y = -2; y <= 2; y++) game.board.addMarker('A', { x: 0, y });
  game.activePlayer = 'A';
  game.turnMode = { tag: 'RunRemoval', playerLastRingMove: 'B' };
  ringMoveFrom = null;
  syncSnapshot();
  hoverCellIndex = coordToIndex({ x: 0, y: 0 });
  refreshMoveHints();
  const focus = yinshWorldPoint({ x: 0, y: 0 });
  scene.setCameraView({ elevationDeg: 40, azimuthDeg: 10, target: focus });
  scene.reframe();
  gameButtons.setStatus('Move assist · choose a five-marker row');
}

function loadAssistAiMoveShot() {
  stopAi();
  humanPlayer = 'A';
  aiPlayer = 'B';
  const start = { x: -1, y: 1 };
  const end = { x: -1, y: -2 };
  game = GameState.initial();
  game.board.addMarker('A', start);
  game.board.addMarker('B', { x: -1, y: 0 });
  game.board.addRing('B', end);
  game.activePlayer = 'A';
  game.turnMode = { tag: 'MarkerPlacement' };
  syncSnapshot();
  const pathCells = buildAiMovePathCells(start, end);
  const pathWorld = buildAiMovePathWorld(start, end);
  const ringPos = scene.getPieceWorldPosition(ringPieceId('B', end));
  lastAiMoveHighlight = {
    fromCell: coordToIndex(start),
    toCell: coordToIndex(end),
    pathCells,
    pathWorld: applyRingLandingToPathWorld(pathWorld, ringPos ? { x: ringPos.x, z: ringPos.z } : null),
    flipPieceIds: [`marker-B-${coordKey({ x: -1, y: 0 })}`],
  };
  refreshMoveHints();
  const focus = yinshWorldPoint({ x: -1, y: -0.5 });
  scene.setCameraView({ elevationDeg: 36, azimuthDeg: 35, target: focus });
  scene.reframe();
  gameButtons.setStatus('Move assist · AI last move');
}

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

const shot = urlParams.get('shot');
if (shot === 'ring-closeup') {
  loadRingCloseupShot();
} else if (shot === 'assist-ring-dest') {
  loadAssistRingMoveShot();
} else if (shot === 'assist-path-flip') {
  loadAssistPathFlipShot();
} else if (shot === 'assist-run-pick') {
  loadAssistRunPickShot();
} else if (shot === 'assist-ai-move') {
  loadAssistAiMoveShot();
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

function moveTapCellIndex(move: Move): number | null {
  switch (move.tag) {
    case 'PlaceRing':
    case 'PlaceMarker':
    case 'RemoveRun':
    case 'RemoveRing':
      return coordToIndex(move.coord);
    case 'MoveRing':
      return coordToIndex(move.end);
    default:
      return null;
  }
}

function simulateBoardTap(clientX: number, clientY: number) {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="board"] canvas');
  if (!canvas) throw new Error('board canvas missing');
  const common: PointerEventInit = {
    clientX,
    clientY,
    button: 0,
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
  };
  canvas.dispatchEvent(new PointerEvent('pointerdown', common));
  canvas.dispatchEvent(new PointerEvent('pointerup', common));
}

async function clickSuggestMove(): Promise<string | null> {
  const move = suggestHumanMove();
  if (!move) return null;
  if (move.tag === 'Wait') {
    await humanMove(move);
    await waitForSettled();
    return move.tag;
  }
  const index = moveTapCellIndex(move);
  if (index === null) {
    await humanMove(move);
    await waitForSettled();
    return move.tag;
  }
  const pt = scene.cellScreen(index);
  simulateBoardTap(pt.x, pt.y);
  await waitForSettled();
  return move.tag;
}

function simulateHoverAtCell(index: number) {
  const pt = scene.cellScreen(index);
  syncYinshInteractionPreview(pt.x, pt.y);
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
    clickSuggestMove,
    waitForSettled,
    finishGameEngine,
    pointsA: () => game.pointsA,
    pointsB: () => game.pointsB,
    cellScreen: (index: number) => scene.cellScreen(index),
    getPieceWorldPosition: (id: string) => scene.getPieceWorldPosition(id),
    ringPieceId,
    coordToIndex,
    simulateHoverAtCell,
    getStackBottomBaseYs: () => scene.getStackBottomBaseYs(),
    setHoverCell: (index: number | null) => {
      hoverCellIndex = index;
      refreshMoveHints();
      syncYinshInteractionPreview();
    },
  };
}

export { scene, game, humanPlayer };
