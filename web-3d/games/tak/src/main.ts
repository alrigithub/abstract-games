import '../style.css';
import {
  BOARD,
  createBoardScene,
  createGameButtons,
  createSquareTopology,
  INTERACTION,
  levelToSearchOptions,
  TAK_AI_STRENGTH_STORAGE_KEY,
  createLoadingScreen,
  setActiveLoadingScreen,
  type InteractionApi,
  type InteractionView,
} from '@abstract/three-engine';
import { loadTakPieceGeometrySet } from './tak-piece-models';
import { toEngineSnapshot, toTakSelection } from './bridge';
import { createGameUi } from './game-ui';
import { canFlipSelectedReserve, canPickReserveCell } from './interaction-policy';
import { stackPickLimit } from './pick-height';
import { createSandboxState, moveSelection, rotateSelection } from './state';
import { createTakInteraction } from './tak-interaction';
import type { BoardState, Color } from './types';

const loading = createLoadingScreen({ gameName: 'Tak' });
setActiveLoadingScreen(loading);

const board = document.querySelector<HTMLDivElement>('#board')!;
const selectionInfo = document.querySelector<HTMLDivElement>('#selection-info')!;
const label = document.querySelector<HTMLSpanElement>('#selection-label')!;
const rotateBtn = document.querySelector<HTMLButtonElement>('#rotate')!;
const pieceActions = document.querySelector<HTMLDivElement>('#piece-actions')!;
const menu = document.querySelector<HTMLDialogElement>('#menu')!;
const sizeSelect = document.querySelector<HTMLSelectElement>('#size')!;

const pieces = await loading.track(loadTakPieceGeometrySet(), 'Loading Tak piece models');
let boardSize = 5;
let topology = createSquareTopology({ size: boardSize, outsideRows: 6 });
let state: BoardState = createSandboxState(boardSize);
const history: BoardState[] = [];
let sandbox = true;
let lastView: InteractionView | null = null;

const scene = await loading.track(
  createBoardScene(board, {
    gridSize: boardSize,
    outsideRows: 6,
    topology,
    pieces,
    boardSlab: BOARD.TAK_SLAB,
    stackedPiecesReceiveShadow: true,
  }),
  'Starting board scene (WebGL + audio)',
);
const stage = board.querySelector('canvas') ?? board;

const cameraViews = scene.createCameraViews();

let controller!: InteractionApi;

function syncFlipBarButton() {
  const btn = document.querySelector<HTMLButtonElement>('[data-testid="flip-stone"]');
  if (!btn || !controller) return;
  const selection = controller.getSelection();
  const takSel = selection ? toTakSelection(selection) : null;
  const canFlipGame =
    gameUi.isActive() &&
    takSel &&
    typeof takSel.source === 'number' &&
    gameUi.canFlipReserveSelection(takSel);
  const canFlipSandbox =
    canEditSandbox() &&
    takSel &&
    typeof takSel.source === 'number' &&
    canFlipSelectedReserve(state, null, takSel.source, true);
  btn.hidden = !canFlipGame && !canFlipSandbox;
}

const gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  cameraViews,
  aiStrengthStorageKey: TAK_AI_STRENGTH_STORAGE_KEY,
  gameActions: [
    {
      testId: 'flip-stone',
      icon: 'flip-vertical',
      className: 'game-button-icon',
      label: '↕',
      ariaLabel: 'Flip stone (flat / wall)',
      title: 'Flat ↔ wall',
      onClick: () => {
        void flipSelectedStone();
      },
    },
  ],
  firstPlayer: {
    title: 'Who goes first?',
    description: 'You vs AI — pick your color.',
    choices: [
      { label: 'You · White', id: 'ivory', testId: 'first-ivory' },
      { label: 'You · Black', id: 'charcoal', testId: 'first-charcoal' },
    ],
    onSelect: id => startAiGame(id as Color),
  },
  onAiStrengthChange: () => gameUi.refresh(),
  onRestartRound: () => {
    cancel();
    if (gameUi.isActive()) gameUi.restartRound();
    else {
      history.length = 0;
      state = createSandboxState(boardSize);
      gameButtons.setStatus('Sandbox');
      refresh();
    }
  },
});


function refresh() {
  scene.setSnapshot(toEngineSnapshot(state));
}

function canEditSandbox() {
  return sandbox && !gameUi.isActive();
}

const gameUi = createGameUi({
  scene,
  onActive: active => {
    sandbox = !active;
    document.querySelector<HTMLButtonElement>('#reset')!.disabled = active;
    syncFlipBarButton();
  },
  onBoard: game => {
    state = game.board;
    refresh();
  },
  setStatus: text => {
    gameButtons.setStatus(text);
    syncFlipBarButton();
  },
  getAiSearchOptions: () => levelToSearchOptions(gameButtons.aiStrength!.getLevel()),
  aiStrengthLabel: () => gameButtons.aiStrength!.getLevel().label,
});

function canUseBoardInteraction() {
  return canEditSandbox() || (gameUi.isActive() && gameUi.humanTurn());
}

function humanColor(): Color | null {
  if (!gameUi.isActive()) return null;
  const game = gameUi.getGame();
  if (gameUi.humanTurn()) return game.toMove;
  return null;
}

controller = createTakInteraction({
  element: stage as HTMLElement,
  getSnapshot: () => toEngineSnapshot(state),
  canInteract: () => canUseBoardInteraction(),
  getHoldInterval: () => INTERACTION.HOLD_INTERVAL,
  getPickHeight(cell) {
    const stack = state.cells[cell] ?? [];
    if (!stack.length) return 0;
    const playable = boardSize * boardSize;
    if (canEditSandbox()) return stack.length;
    if (cell >= playable) {
      if (!canPickReserveCell(state, gameUi.isActive() ? gameUi.getGame() : null, cell, false, humanColor())) return 0;
      return 1;
    }
    if (!gameUi.isActive() || !gameUi.humanTurn()) return 0;
    const mover: Color = gameUi.getGame().toMove;
    return stackPickLimit(stack, mover, true, boardSize);
  },
  hitTest: (x, y) => (canUseBoardInteraction() ? scene.hitTest(x, y) : null),
  hitReserve: (x, y) => (canEditSandbox() ? scene.hitReserve(x, y) : null),
  onView: view => {
    lastView = view;
    scene.setInteraction(view);
    selectionInfo.hidden = !view.selection;
    board.classList.toggle('is-dragging', view.dragging);
    syncFlipBarButton();
    if (view.selection) {
      label.textContent = String(view.selection.count);
      document.querySelector<HTMLElement>('#hold-ring')!.style.setProperty('--progress', `${view.progress * 360}deg`);
      pieceActions.hidden = !canEditSandbox();
      const source = view.selection.source;
      const top =
        typeof source === 'number'
          ? state.cells[source]?.at(-1)
          : undefined;
      rotateBtn.hidden = view.selection.count !== 1 || top?.kind !== 'stone';
    } else {
      pieceActions.hidden = true;
    }
  },
  onCommit: (selection, target) => {
    if (gameUi.isActive()) {
      gameUi.commitDrag(toTakSelection(selection), target);
      return;
    }
    const next = moveSelection(state, toTakSelection(selection), target);
    if (next !== state) commit(next);
  },
  onReserveCommit: (selection, _target) => {
    void selection;
    void _target;
  },
});

function commit(next: BoardState) {
  if (!canEditSandbox()) return;
  history.push(state);
  state = next;
  refresh();
}

function cancel() {
  controller.cancel();
}

function forcedHumanColor(): Color | null {
  const forced = new URLSearchParams(location.search).get('human');
  return forced === 'ivory' || forced === 'charcoal' ? forced : null;
}

function startAiGame(human: Color) {
  cancel();
  history.length = 0;
  gameUi.startAi(human, boardSize);
  menu.close();
}

function startSandbox() {
  gameUi.stop();
  cancel();
  history.length = 0;
  state = createSandboxState(boardSize);
  gameButtons.setStatus('Sandbox');
  menu.close();
  refresh();
}

document.querySelector('#menu-toggle')!.addEventListener('click', () => menu.showModal());
menu.querySelector('[data-testid="mode-sandbox"]')!.addEventListener('click', () => startSandbox());
menu.querySelector('[data-testid="mode-ai"]')!.addEventListener('click', () => {
  const human = forcedHumanColor() ?? 'ivory';
  startAiGame(human);
});
sizeSelect.addEventListener('change', () => {
  boardSize = Number(sizeSelect.value);
  topology = createSquareTopology({ size: boardSize, outsideRows: 6 });
  cancel();
  history.length = 0;
  if (gameUi.isActive()) {
    gameUi.stop();
  }
  state = createSandboxState(boardSize);
  gameButtons.setStatus('Sandbox');
  refresh();
});

document.querySelector('#reset')!.addEventListener('click', () => {
  cancel();
  commit(createSandboxState(boardSize));
});
document.querySelector('#undo')!.addEventListener('click', () => {
  if (gameUi.isActive()) {
    gameUi.undo();
    return;
  }
  cancel();
  const prev = history.pop();
  if (prev) {
    state = prev;
    refresh();
  }
});
document.querySelector('#end-turn')!.addEventListener('click', () => {
  if (gameUi.isActive()) gameUi.endTurn();
  else cancel();
});
document.querySelector('#done')!.addEventListener('click', cancel);
async function flipSelectedStone() {
  const selection = controller.getSelection();
  if (!selection || typeof selection.source !== 'number') return;
  rotateBtn.disabled = true;
  try {
    if (gameUi.isActive()) {
      const takSel = toTakSelection(selection);
      const pieceId = gameUi.flipReserveSelection(takSel);
      if (!pieceId) return;
      await scene.flipPiece(pieceId);
      if (lastView) scene.setInteraction(lastView);
      syncFlipBarButton();
      return;
    }
    if (!canEditSandbox()) return;
    const top = state.cells[selection.source]?.at(-1);
    if (!top || top.kind !== 'stone') return;
    await scene.flipPiece(top.id);
    const next = rotateSelection(state, toTakSelection(selection));
    if (next !== state) {
      commit(next);
      if (lastView) scene.setInteraction(lastView);
    }
  } finally {
    rotateBtn.disabled = false;
  }
}

rotateBtn.addEventListener('click', () => {
  void flipSelectedStone();
});

let cameraMode: 'pan' | 'orbit' = 'pan';
document.querySelector('#camera-mode')!.addEventListener('click', () => {
  cancel();
  cameraMode = cameraMode === 'pan' ? 'orbit' : 'pan';
  scene.setCameraMode(cameraMode);
  (document.querySelector('#camera-mode') as HTMLButtonElement).textContent = cameraMode === 'pan' ? 'Pan' : 'Orbit';
});

refresh();
gameButtons.setStatus('Sandbox');
menu.showModal();

await loading.done();
setActiveLoadingScreen(null);

if (location.search.includes('human=ivory')) {
  (window as unknown as {
    __takE2e?: {
      pilePoint(): { x: number; y: number };
      centerPoint(): { x: number; y: number };
      openingReservePoint(): { x: number; y: number };
      capReservePoint(color?: Color): { x: number; y: number };
      seedCapStackDemo(): void;
      seedGlbDemo(): void;
    };
  }).__takE2e = {
    pilePoint() {
      let index = 0;
      let height = 0;
      state.cells.forEach((stack, i) => {
        if (stack.length > height) {
          height = stack.length;
          index = i;
        }
      });
      return scene.cellScreen(index);
    },
    centerPoint() {
      const mid = Math.floor((boardSize * boardSize) / 2);
      return scene.cellScreen(mid);
    },
    openingReservePoint() {
      const playable = boardSize * boardSize;
      let index = playable;
      let height = 0;
      state.cells.forEach((stack, i) => {
        if (i < playable || !stack.length) return;
        const top = stack.at(-1);
        if (top?.color !== 'charcoal' || top.kind !== 'stone') return;
        if (stack.length >= height) {
          height = stack.length;
          index = i;
        }
      });
      return scene.cellScreen(index);
    },
    capReservePoint(color: Color = 'ivory') {
      const playable = boardSize * boardSize;
      for (let i = playable; i < state.cells.length; i++) {
        const top = state.cells[i]?.at(-1);
        if (top?.kind === 'capstone' && top.color === color) return scene.cellScreen(i);
      }
      return scene.cellScreen(playable);
    },
    seedCapStackDemo() {
      const mid = Math.floor((boardSize * boardSize) / 2);
      const cap = state.cells.flat().find(p => p.kind === 'capstone' && p.color === 'ivory');
      if (!cap) return;
      const flats = Array.from({ length: 3 }, (_, i) => ({
        id: `demo-flat-${i}`,
        color: 'ivory' as const,
        kind: 'stone' as const,
        orientation: 'flat' as const,
      }));
      state.cells[mid] = [...flats, { ...cap, id: 'demo-cap-stack' }];
      const sourceIndex = state.cells.findIndex((stack, i) => i >= boardSize * boardSize && stack.some(p => p.id === cap.id));
      if (sourceIndex >= 0) {
        state.cells[sourceIndex] = state.cells[sourceIndex]!.filter(p => p.id !== cap.id);
      }
      refresh();
    },
    seedGlbDemo() {
      cancel();
      state = createSandboxState(boardSize);
      const flat = (color: Color, id: string) => ({
        id,
        color,
        kind: 'stone' as const,
        orientation: 'flat' as const,
      });
      const wall = (color: Color, id: string) => ({
        id,
        color,
        kind: 'stone' as const,
        orientation: 'standing' as const,
      });
      const cap = (color: Color, id: string) => ({
        id,
        color,
        kind: 'capstone' as const,
        orientation: 'flat' as const,
      });
      state.cells[6] = [flat('ivory', 'demo-i-flat')];
      state.cells[7] = [wall('charcoal', 'demo-c-wall')];
      state.cells[8] = [cap('ivory', 'demo-i-cap')];
      state.cells[12] = [flat('ivory', 's1'), flat('charcoal', 's2'), flat('ivory', 's3'), cap('charcoal', 's-cap')];
      state.cells[13] = [flat('charcoal', 'd4'), wall('ivory', 'd5')];
      refresh();
    },
  };
}
