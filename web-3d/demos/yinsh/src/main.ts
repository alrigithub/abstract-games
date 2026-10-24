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
  yinshPieceGeometrySet,
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
    aiPending = false;
    const move = event.data.move;
    void scene.enqueueAnimation(async () => {
      if (move) await performMove(move);
      renderStatus();
      if (!game.winner() && game.activePlayer === aiPlayer) await runAiTurn();
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
  (event: MouseEvent) => {
    if (!humanTurn() || lastDragging) return;
    const cell = scene.hitTest(event.clientX, event.clientY);
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
    { id: 'ring-A-0,0', player: 'A', shape: 'ring' },
    { id: 'marker-A-0,0', player: 'A', shape: 'marker' },
  ];
  scene.setSnapshot({
    playableCells: YINSH_COORDS.length,
    cellCount: YINSH_COORDS.length,
    cells,
    reserves: [],
  });
  scene.reframe();
  gameButtons.setStatus('Ring close-up · GIPF marker in hole');
  document.body.dataset.shotMode = 'ring-closeup';
}

if (new URLSearchParams(location.search).get('shot') === 'ring-closeup') {
  loadRingCloseupShot();
} else {
  startGame('A');
}

export { scene, game, humanPlayer };
