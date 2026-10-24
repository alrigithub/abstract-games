import '../style.css';
import {
  BOARD,
  createBoardScene,
  createInteraction,
  createSquareTopology,
  createTakPieceGeometries,
  readStoredTheme,
  storeTheme,
  takPieceGeometrySet,
  type InteractionView,
  type ThemeId,
} from '@abstract/three-engine';
import { toEngineSnapshot, toTakSelection } from './bridge';
import { createGameUi } from './game-ui';
import { createSandboxState, moveSelection, rotateSelection } from './state';
import type { BoardState } from './types';

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
let theme: ThemeId = readStoredTheme();
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

function refresh() {
  scene.setSnapshot(toEngineSnapshot(state));
}

function canEditSandbox() {
  return sandbox && !gameUi.isActive();
}

const gameUi = createGameUi({
  scene,
  board,
  onActive: active => {
    sandbox = !active;
    document.querySelector<HTMLButtonElement>('#reset')!.disabled = active;
  },
  onBoard: game => {
    state = game.board;
    refresh();
  },
});

const controller = createInteraction({
  element: stage as HTMLElement,
  getSnapshot: () => toEngineSnapshot(state),
  canInteract: () => canEditSandbox(),
  hitTest: (x, y) => (canEditSandbox() ? scene.hitTest(x, y) : null),
  hitReserve: (x, y) => (canEditSandbox() ? scene.hitReserve(x, y) : null),
  onView: view => {
    lastView = view;
    scene.setInteraction(view);
    selectionInfo.hidden = !view.selection;
    board.classList.toggle('is-dragging', view.dragging);
    if (view.selection) {
      label.textContent = String(view.selection.count);
      document.querySelector<HTMLElement>('#hold-ring')!.style.setProperty('--progress', `${view.progress * 360}deg`);
      pieceActions.hidden = false;
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

document.querySelector('#theme-toggle')!.addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light';
  storeTheme(theme);
  scene.setTheme(theme);
  document.documentElement.dataset.theme = theme;
});

document.querySelector('#menu-toggle')!.addEventListener('click', () => menu.showModal());
menu.querySelector('[data-testid="mode-sandbox"]')!.addEventListener('click', () => {
  gameUi.stop();
  cancel();
  history.length = 0;
  state = createSandboxState(boardSize);
  menu.close();
  refresh();
});
menu.querySelector('[data-testid="mode-ai"]')!.addEventListener('click', () => {
  cancel();
  history.length = 0;
  gameUi.start('ai', boardSize);
  menu.close();
});
sizeSelect.addEventListener('change', () => {
  boardSize = Number(sizeSelect.value);
  topology = createSquareTopology({ size: boardSize, outsideRows: 6 });
  cancel();
  history.length = 0;
  state = createSandboxState(boardSize);
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

document.documentElement.dataset.theme = theme;
refresh();
menu.showModal();

if (location.search.includes('human=ivory')) {
  (window as unknown as { __takE2e?: { pilePoint(): { x: number; y: number }; centerPoint(): { x: number; y: number } } }).__takE2e = {
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
  };
}
