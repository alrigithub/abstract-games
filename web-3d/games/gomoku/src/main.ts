import {
  AiWorkerSession,
  createGameButtons,
  GOMOKU_AI_STRENGTH_STORAGE_KEY,
  playWinSoundAfterPlace,
  recordAiThinkMetrics,
  createLoadingScreen,
  setActiveLoadingScreen,
  type GameButtonsBar,
} from '@abstract/three-engine';
import { GOMOKU_AI_STRENGTH_LEVELS, gomokuLevelToSearchOptions } from './game/ai';
import { createGomokuScene, type ScenePlayer, type StoneRecord } from './gomoku-scene';
import { loadGomokuPrerender } from './gomoku-prerender';
import {
  applyMove,
  coordIndex,
  createGame,
  indexCoord,
  legalMoves,
  winningLine,
  type GameState,
  type Move,
  type Player,
} from './game/engine';

const loading = createLoadingScreen({ gameName: 'Gomoku' });
setActiveLoadingScreen(loading);

const board = document.querySelector<HTMLDivElement>('#board')!;

let humanColor: Player = 'black';
let game: GameState = createGame();
let aiPending = false;
let aiGeneration = 0;
const aiSession = new AiWorkerSession();

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
  aiSession.cancel();
  aiPending = false;
}

async function maybeAiTurn() {
  if (game.winner || game.toMove === humanColor || !gameButtons?.aiStrength || aiPending) return;
  aiPending = true;
  scene.setInputEnabled(false);
  renderStatus();
  const gen = ++aiGeneration;
  const search = gomokuLevelToSearchOptions(gameButtons.aiStrength.getLevel());
  document.body.dataset.lastAiDepth = String(search.maxDepth);
  document.body.dataset.lastAiMaxNodes = String(search.maxNodes);
  const t0 = performance.now();
  const move = await aiSession.request<Move | null>({
    createWorker: () => new Worker(new URL('./game/ai.worker.ts', import.meta.url), { type: 'module' }),
    postMessage: (worker, id) => worker.postMessage({ id, game, options: search }),
    parseMessage: (event, id) => {
      const data = event.data as { id: number; move: Move | null };
      if (data.id !== id) return undefined;
      return data.move ?? null;
    },
    timeBudgetMs: search.maxTimeMs,
  });
  recordAiThinkMetrics(performance.now() - t0);
  if (gen !== aiGeneration) return;
  aiPending = false;
  const resolved = move ?? legalMoves(game)[0] ?? null;
  if (resolved && !game.winner) {
    void playMove(resolved.coord.x, resolved.coord.y, false);
  } else {
    scene.setInputEnabled(true);
    renderStatus(resolved ? undefined : 'AI could not move — try undo or new game');
  }
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

const prerender = await loading.track(loadGomokuPrerender(), 'Loading Gomoku prerender plate');

const scene = await loading.track(
  createGomokuScene(board, {
    prerender,
    onCellClick: (row, col) => void playMove(col, row, true),
    canInteract: () => !aiPending && !game.winner && game.toMove === humanColor,
    hoverPlayer: () => (game.winner || game.toMove !== humanColor ? null : toScenePlayer(humanColor)),
  }),
  'Starting Gomoku scene (prerender plate + stones)',
);

let gameButtons: GameButtonsBar | undefined;

gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  aiStrengthStorageKey: GOMOKU_AI_STRENGTH_STORAGE_KEY,
  aiStrengthLevels: [...GOMOKU_AI_STRENGTH_LEVELS],
  onAiStrengthChange: level => renderStatus(undefined, level.label),
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

function applyDemoShot() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot !== 'win-glow' && shot !== 'mid-stones') return;

  stopAi();
  humanColor = 'black';
  game = createGame();

  if (shot === 'mid-stones') {
    const placements: [number, number, Player][] = [
      [7, 7, 'black'],
      [7, 8, 'white'],
      [8, 7, 'white'],
      [8, 8, 'black'],
      [6, 7, 'white'],
      [7, 6, 'black'],
      [8, 6, 'white'],
      [6, 8, 'black'],
      [9, 7, 'white'],
      [7, 9, 'black'],
      [6, 6, 'black'],
      [8, 9, 'white'],
    ];
    for (const [row, col, player] of placements) {
      game.cells[coordIndex({ x: col, y: row })] = player;
    }
    game.toMove = 'white';
    game.moveCount = placements.length;
    scene.setInputEnabled(false);
    syncBoard();
    renderStatus('Mid-game');
    document.body.dataset.demoShot = 'mid-stones';
    return;
  }

  const row = 7;
  for (let col = 5; col <= 9; col++) {
    game.cells[coordIndex({ x: col, y: row })] = 'black';
  }
  game.winner = 'black';
  game.lastMove = { x: 9, y: row };
  game.toMove = 'white';
  game.moveCount = 5;
  scene.setInputEnabled(false);
  syncBoard();
  renderStatus('Black wins');
  document.body.dataset.demoShot = 'win-glow';
}

applyDemoShot();

if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('shot') === 'win-glow') {
  (window as unknown as { __gomokuWinGlowCount?: () => number }).__gomokuWinGlowCount = () => {
    const line = winLineCells();
    return line?.length ?? 0;
  };
}

const demoShot = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get(
  'shot',
);
if (!demoShot) {
  startGame('black');
}

await loading.done();
setActiveLoadingScreen(null);
