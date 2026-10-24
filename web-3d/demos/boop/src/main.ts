import {
  boopPieceGeometrySet,
  cellIndex,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createGameButtons,
  createSquareTopology,
  DEFAULT_LOBBY_HREF,
  GOMOKU_AI_STRENGTH_STORAGE_KEY,
  readStoredTheme,
  bindThemeToggle,
  storeTheme,
  THEME_STORAGE_KEY,
  type BoardSnapshot,
  type EnginePiece,
  type SceneApi,
  type ThemeId,
} from '@abstract/three-engine';

const STATUS = 'Boop — piece preview (rules & AI coming)';

const size = 6;
const OUTSIDE_ROWS = 2;
const cellTotal = (size + OUTSIDE_ROWS * 2) ** 2;
const KITTENS_PER_PLAYER = 8;
const CATS_PER_PLAYER = 3;

const cat = createBoopCatGeometry();
const kitten = createBoopKittenGeometry();
const pieces = boopPieceGeometrySet(cat, kitten);
const topology = createSquareTopology({ size, outsideRows: OUTSIDE_ROWS });

function pushStack(
  cells: EnginePiece[][],
  row: number,
  col: number,
  player: 'A' | 'B',
  shape: 'cat' | 'kitten',
  count: number,
  prefix: string,
) {
  const index = cellIndex(size, row, col, OUTSIDE_ROWS);
  if (index === null) return;
  for (let i = 0; i < count; i++) {
    cells[index]!.push({ id: `${prefix}-${i}`, player, shape });
  }
}

function fullSidePools(cells: EnginePiece[][]) {
  const leftCol = -2;
  const rightCol = size + 1;
  pushStack(cells, 3, leftCol, 'A', 'kitten', KITTENS_PER_PLAYER, 'pool-a-k');
  pushStack(cells, 5, leftCol, 'A', 'cat', CATS_PER_PLAYER, 'pool-a-c');
  pushStack(cells, 3, rightCol, 'B', 'kitten', KITTENS_PER_PLAYER, 'pool-b-k');
  pushStack(cells, 5, rightCol, 'B', 'cat', CATS_PER_PLAYER, 'pool-b-c');
}

/** Midgame layout for piece preview (initial view). */
function mockupOnBoard(cells: EnginePiece[][]) {
  const at = (row: number, col: number, piece: EnginePiece) => {
    cells[row * size + col]!.push(piece);
  };
  at(2, 2, { id: 'w-cat-1', player: 'A', shape: 'cat' });
  at(2, 3, { id: 'b-kitten-1', player: 'B', shape: 'kitten' });
  at(3, 2, { id: 'b-cat-1', player: 'B', shape: 'cat' });
  at(3, 3, { id: 'w-kitten-1', player: 'A', shape: 'kitten' });
  at(2, 4, { id: 'b-kitten-2', player: 'B', shape: 'kitten' });
  at(4, 2, { id: 'w-cat-2', player: 'A', shape: 'cat' });
  at(4, 3, { id: 'w-kitten-2', player: 'A', shape: 'kitten' });
}

function buildSnapshot(emptyBoard: boolean): BoardSnapshot {
  const cells: EnginePiece[][] = Array.from({ length: cellTotal }, () => []);
  if (!emptyBoard) mockupOnBoard(cells);
  fullSidePools(cells);
  return {
    playableCells: size * size,
    cellCount: cellTotal,
    cells,
  };
}

const board = document.querySelector<HTMLDivElement>('#board')!;
let theme: ThemeId = readStoredTheme();
document.documentElement.dataset.theme = theme;

const scene = await createBoardScene(board, {
  gridSize: size,
  topology,
  pieces,
  initialTheme: theme,
});

function applyTheme(id: ThemeId) {
  theme = id;
  scene.setTheme(id);
}

const gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  lobbyHref: DEFAULT_LOBBY_HREF,
  aiStrengthStorageKey: GOMOKU_AI_STRENGTH_STORAGE_KEY,
  onFirstPlayerSelected: () => {},
});

gameButtons.root.querySelector('[data-testid="first-player-popover"]')?.remove();
gameButtons.aiStrength.destroy();

const row = gameButtons.root.querySelector('.game-button-row')!;
const themeBtn = document.createElement('button');
themeBtn.type = 'button';
themeBtn.dataset.testid = 'theme-toggle';
themeBtn.setAttribute('aria-label', 'Toggle theme');
themeBtn.textContent = '◐';
row.insertBefore(themeBtn, row.querySelector('.game-button-ai-slot'));

bindThemeToggle(themeBtn, applyTheme);

const newGameBtn = row.querySelector<HTMLButtonElement>('[data-testid="new-game"]')!;
const newGame = newGameBtn.cloneNode(true) as HTMLButtonElement;
newGameBtn.replaceWith(newGame);
newGame.addEventListener('click', () => resetBoard());

function resetBoard() {
  scene.setSnapshot(buildSnapshot(true));
  gameButtons.setStatus(STATUS);
}

function loadPreview() {
  scene.setSnapshot(buildSnapshot(false));
  gameButtons.setStatus(STATUS);
}

loadPreview();

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

declare global {
  interface Window {
    __boopScene?: SceneApi;
    __boopSetTheme?: (theme: ThemeId) => void;
  }
}

window.__boopScene = scene;
window.__boopSetTheme = (id: ThemeId) => {
  storeTheme(id);
  applyTheme(id);
};

const params = new URLSearchParams(location.search);
const forcedTheme = params.get('theme');
if (forcedTheme === 'light' || forcedTheme === 'dark') {
  window.__boopSetTheme(forcedTheme);
}

board.dataset.ready = 'true';
