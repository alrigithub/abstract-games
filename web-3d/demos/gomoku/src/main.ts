import {
  createGameButtons,
  GOMOKU_AI_STRENGTH_STORAGE_KEY,
  levelToSearchOptions,
  playWinSoundAfterPlace,
  readInitialTheme,
  type GameButtonsBar,
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

let theme: ThemeId = readInitialTheme();

let humanColor: Player = 'black';
let game: GameState = createGame();
let aiPending = false;
let aiGeneration = 0;
let aiWorker: Worker | null = null;

function applyTheme(id: ThemeId) {
  theme = id;
  scene.setTheme(id);
  // bindThemeToggle runs during createGameButtons — gameButtons is not initialized yet.
  if (typeof gameButtons !== 'undefined') syncBoard();
}


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

function stoneCount(): number {
  return game.cells.filter(Boolean).length;
}

function winLineCells(): { row: number; col: number }[] | null {
  if (!game.winner || !game.lastMove) return null;
  return winningLine(game, game.lastMove)?.map(c => ({ row: c.y, col: c.x })) ?? null;
}

function renderStatus(extra?: string, strengthLabel?: string) {
  if (!gameButtons) return;
  const human = humanColor === 'black' ? 'Black' : 'White';
  const strength = strengthLabel ?? gameButtons.aiStrength!.getLevel().label;
  let detail = extra;
  if (!detail) {
    if (game.winner) detail = `${game.winner === 'black' ? 'Black' : 'White'} wins`;
    else if (aiPending) detail = 'AI thinking…';
    else if (game.toMove === humanColor) detail = `Your turn · ${human}`;
    else detail = 'AI to move';
  }
  gameButtons.setStatus(`${detail} · AI ${strength}`);
}

function syncBoard() {
  document.body.dataset.stoneCount = String(stoneCount());
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
  if (game.winner || game.toMove === humanColor || !gameButtons?.aiStrength) return;
  aiPending = true;
  scene.setInputEnabled(false);
  renderStatus();
  const gen = ++aiGeneration;
  const search = levelToSearchOptions(gameButtons.aiStrength.getLevel());
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
  if (game.winner) playWinSoundAfterPlace();
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

const cameraViews = scene.createCameraViews();

let gameButtons: GameButtonsBar | undefined;

gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  cameraViews,
  aiStrengthStorageKey: GOMOKU_AI_STRENGTH_STORAGE_KEY,
  onAiStrengthChange: level => renderStatus(undefined, level.label),
  applyTheme,
  onFirstPlayerSelected: color => startGame(color),
  onRestartRound: () => startGame(humanColor),
});

renderStatus();

function startGame(color: Player) {
  stopAi();
  humanColor = color;
  game = createGame();
  syncBoard();
  scene.setInputEnabled(true);
  if (game.toMove !== humanColor) maybeAiTurn();
}

startGame('black');
