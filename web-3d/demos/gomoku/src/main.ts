import {
  createAiStrengthControl,
  GOMOKU_AI_STRENGTH_STORAGE_KEY,
  levelToSearchOptions,
  readStoredTheme,
  storeTheme,
  type ThemeId,
} from '@abstract/three-engine';
import { createGomokuScene, type ScenePlayer, type StoneRecord } from './gomoku-scene';
import {
  applyMove,
  coordIndex,
  createGame,
  indexCoord,
  winningLine,
  type GameState,
  type Player,
} from './game/engine';

const board = document.querySelector<HTMLDivElement>('#board')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#game-status')!;
const newGameBtn = document.querySelector<HTMLButtonElement>('#new-game')!;
const firstDialog = document.querySelector<HTMLDialogElement>('#first-player')!;

let theme: ThemeId = readStoredTheme();
document.documentElement.dataset.theme = theme;

let humanColor: Player = 'black';
let game: GameState = createGame();
let aiPending = false;
let aiGeneration = 0;
let aiWorker: Worker | null = null;

const aiStrength = createAiStrengthControl({
  container: document.querySelector('#ai-strength-mount')!,
  storageKey: GOMOKU_AI_STRENGTH_STORAGE_KEY,
  onChange: level => renderStatus(undefined, level.label),
});

function toScenePlayer(player: Player): ScenePlayer {
  return player === 'white' ? 'A' : 'B';
}

function stonesFromGame(): StoneRecord[] {
  const out: StoneRecord[] = [];
  for (let i = 0; i < game.cells.length; i++) {
    const occupant = game.cells[i];
    if (!occupant) continue;
    const { x, y } = indexCoord(i);
    out.push({ id: `c-${x}-${y}`, row: y, col: x, player: toScenePlayer(occupant) });
  }
  return out;
}

function winLineCells(): { row: number; col: number }[] | null {
  if (!game.winner || !game.lastMove) return null;
  return winningLine(game, game.lastMove)?.map(c => ({ row: c.y, col: c.x })) ?? null;
}

function renderStatus(extra?: string, strengthLabel?: string) {
  const human = humanColor === 'black' ? 'Black' : 'White';
  const ai = humanColor === 'black' ? 'White' : 'Black';
  const strength = strengthLabel ?? aiStrength.getLevel().label;
  let detail = extra;
  if (!detail) {
    if (game.winner) detail = `${game.winner === 'black' ? 'Black' : 'White'} wins`;
    else if (aiPending) detail = `${ai} (AI) thinking…`;
    else if (game.toMove === humanColor) detail = `Your turn (${human})`;
    else detail = `${ai} to move`;
  }
  statusEl.textContent = `You · ${human} vs AI · ${ai} · AI ${strength} — ${detail}`;
}

function syncBoard() {
  scene.setStones(stonesFromGame(), winLineCells());
  renderStatus();
}

function stopAi() {
  aiGeneration++;
  aiWorker?.terminate();
  aiWorker = null;
  aiPending = false;
}

function maybeAiTurn() {
  if (game.winner || game.toMove === humanColor) return;
  aiPending = true;
  scene.setInputEnabled(false);
  renderStatus();
  const gen = ++aiGeneration;
  const search = levelToSearchOptions(aiStrength.getLevel());
  document.body.dataset.lastAiDepth = String(search.maxDepth);
  document.body.dataset.lastAiMaxNodes = String(search.maxNodes);
  aiWorker = new Worker(new URL('./game/ai.worker.ts', import.meta.url), { type: 'module' });
  aiWorker.onmessage = (event: MessageEvent<{ id: number; move: { type: 'place'; coord: { x: number; y: number } } | null }>) => {
    if (event.data.id !== gen || gen !== aiGeneration) return;
    aiWorker?.terminate();
    aiWorker = null;
    aiPending = false;
    const move = event.data.move;
    if (move && !game.winner) {
      void playMove(move.coord.x, move.coord.y, false);
    } else {
      scene.setInputEnabled(true);
      renderStatus();
    }
  };
  aiWorker.postMessage({ id: gen, game, options: search });
}

async function playMove(col: number, row: number, isHuman: boolean) {
  if (game.winner) return;
  const idx = coordIndex({ x: col, y: row });
  if (game.cells[idx]) return;
  if (isHuman && (aiPending || game.toMove !== humanColor)) return;

  scene.setInputEnabled(false);
  const move = { type: 'place' as const, coord: { x: col, y: row } };
  game = applyMove(game, move);
  const placed = game.cells[idx]!;
  const record: StoneRecord = {
    id: `c-${col}-${row}`,
    row,
    col,
    player: toScenePlayer(placed),
  };
  await scene.animateDrop(record);
  syncBoard();
  scene.setInputEnabled(!game.winner && game.toMove === humanColor && !aiPending);
  if (!game.winner) maybeAiTurn();
}

const scene = createGomokuScene(board, {
  theme,
  onCellClick: (row, col) => void playMove(col, row, true),
  canInteract: () => !aiPending && !game.winner && game.toMove === humanColor,
  hoverPlayer: () => (game.winner || game.toMove !== humanColor ? null : toScenePlayer(humanColor)),
});

function startGame(color: Player) {
  stopAi();
  humanColor = color;
  game = createGame();
  syncBoard();
  scene.setInputEnabled(true);
  if (game.toMove !== humanColor) maybeAiTurn();
}

document.querySelector('#theme-toggle')!.addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light';
  storeTheme(theme);
  document.documentElement.dataset.theme = theme;
  scene.setTheme(theme);
  syncBoard();
});

newGameBtn.addEventListener('click', () => firstDialog.showModal());

firstDialog.querySelectorAll<HTMLButtonElement>('[data-first]').forEach(button => {
  button.addEventListener('click', () => {
    const pick = button.dataset.first;
    firstDialog.close();
    startGame(pick === 'white' ? 'white' : 'black');
  });
});

firstDialog.querySelector('[data-cancel]')?.addEventListener('click', () => firstDialog.close());

startGame('black');
