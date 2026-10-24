import '../style.css';
import {
  BOARD,
  createBoardScene,
  createGameButtons,
  createInteraction,
  createSquareTopology,
  createTakPieceGeometries,
  INTERACTION,
  levelToSearchOptions,
  readInitialTheme,
  TAK_AI_STRENGTH_STORAGE_KEY,
  takPieceGeometrySet,
  type InteractionView,
  type ThemeId,
} from '@abstract/three-engine';
import { toEngineSnapshot, toTakSelection } from './bridge';
import { createGameUi } from './game-ui';
import { stackPickLimit } from './pick-height';
import { createSandboxState, moveSelection, rotateSelection } from './state';
import type { BoardState, Color } from './types';

const board = document.querySelector<HTMLDivElement>('#board')!;
const selectionInfo = document.querySelector<HTMLDivElement>('#selection-info')!;
const label = document.querySelector<HTMLSpanElement>('#selection-label')!;
const rotateBtn = document.querySelector<HTMLButtonElement>('#rotate')!;
const pieceActions = document.querySelector<HTMLDivElement>('#piece-actions')!;
const menu = document.querySelector<HTMLDialogElement>('#menu')!;
const sizeSelect = document.querySelector<HTMLSelectElement>('#size')!;

const geos = createTakPieceGeometries();
const pieces = takPieceGeometrySet(geos);
let boardSize = 5;
let topology = createSquareTopology({ size: boardSize, outsideRows: 6 });
let theme: ThemeId = readInitialTheme();
let state: BoardState = createSandboxState(boardSize);
const history: BoardState[] = [];
let sandbox = true;
let lastView: InteractionView | null = null;

const scene = await createBoardScene(board, {
  gridSize: boardSize,
  topology,
  pieces,
  initialTheme: theme,
  boardSlab: BOARD.TAK_SLAB,
});
const stage = board.querySelector('canvas') ?? board;

function applyTheme(id: ThemeId) {
  theme = id;
  scene.setTheme(id);
}

const cameraViews = scene.createCameraViews();

const gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  cameraViews,
  aiStrengthStorageKey: TAK_AI_STRENGTH_STORAGE_KEY,
  applyTheme,
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
  },
  onBoard: game => {
    state = game.board;
    refresh();
  },
  setStatus: text => gameButtons.setStatus(text),
  getAiSearchOptions: () => levelToSearchOptions(gameButtons.aiStrength!.getLevel()),
  aiStrengthLabel: () => gameButtons.aiStrength!.getLevel().label,
});

function canUseBoardInteraction() {
  return canEditSandbox() || (gameUi.isActive() && gameUi.humanTurn());
}

const controller = createInteraction({
  element: stage as HTMLElement,
  getSnapshot: () => toEngineSnapshot(state),
  canInteract: () => canUseBoardInteraction(),
  getHoldInterval: () => INTERACTION.HOLD_INTERVAL,
  getPickHeight(cell) {
    const stack = state.cells[cell] ?? [];
    if (!stack.length) return 0;
    const playable = boardSize * boardSize;
    if (canEditSandbox()) return stack.length;
    if (cell >= playable) return 1;
    if (!gameUi.isActive() || !gameUi.humanTurn()) return stack.length;
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
rotateBtn.addEventListener('click', () => {
  void (async () => {
    if (!canEditSandbox()) return;
    const selection = controller.getSelection();
    if (!selection || typeof selection.source !== 'number') return;
    const top = state.cells[selection.source]?.at(-1);
    if (!top || top.kind !== 'stone') return;
    rotateBtn.disabled = true;
    try {
      await scene.flipPiece(top.id);
      const next = rotateSelection(state, toTakSelection(selection));
      if (next !== state) {
        commit(next);
        if (lastView) scene.setInteraction(lastView);
      }
    } finally {
      rotateBtn.disabled = false;
    }
  })();
});

let cameraMode: 'pan' | 'orbit' = 'pan';
document.querySelector('#camera-mode')!.addEventListener('click', () => {
  cancel();
  cameraMode = cameraMode === 'pan' ? 'orbit' : 'pan';
  scene.setCameraMode(cameraMode);
  (document.querySelector('#camera-mode') as HTMLButtonElement).textContent = cameraMode === 'pan' ? 'Pan' : 'Orbit';
});

applyTheme(theme);
refresh();
gameButtons.setStatus('Sandbox');
menu.showModal();

if (location.search.includes('human=ivory')) {
  (window as unknown as {
    __takE2e?: {
      pilePoint(): { x: number; y: number };
      centerPoint(): { x: number; y: number };
      openingReservePoint(): { x: number; y: number };
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
  };
}
