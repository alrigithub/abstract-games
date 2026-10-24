import {
  allYinshCoords,
  createBoardScene,
  createYinshMarkerGeometry,
  createYinshRingGeometry,
  createYinshTopology,
  readStoredTheme,
  storeTheme,
  yinshIndex,
  yinshPieceGeometrySet,
  yinshRackPosition,
  type BoardSnapshot,
  type EnginePiece,
  type ThemeId,
} from '@abstract/three-engine';

const coords = allYinshCoords();
const cellCount = coords.length;
const topology = createYinshTopology();

const ringGeo = createYinshRingGeometry();
const markerGeo = createYinshMarkerGeometry();
const pieces = yinshPieceGeometrySet(ringGeo, markerGeo);

function cell(...entries: EnginePiece[]): EnginePiece[] {
  return entries;
}

function at(x: number, y: number): number {
  const index = yinshIndex({ x, y });
  if (index < 0) throw new Error(`coord ${x},${y} not on board`);
  return index;
}

const cells: EnginePiece[][] = Array.from({ length: cellCount }, () => []);

cells[at(0, 0)] = cell(
  { id: 'ring-w', player: 'A', shape: 'ring' },
  { id: 'marker-center', player: 'A', shape: 'marker' },
);
cells[at(1, 0)] = cell({ id: 'ring-b1', player: 'B', shape: 'ring' });
cells[at(2, 0)] = cell(
  { id: 'ring-w2', player: 'A', shape: 'ring' },
  { id: 'marker-flip-a', player: 'A', shape: 'marker' },
);
cells[at(3, 0)] = cell(
  { id: 'ring-b2', player: 'B', shape: 'ring' },
  { id: 'marker-flip-b', player: 'B', shape: 'marker' },
);
cells[at(4, 0)] = cell(
  { id: 'ring-w3', player: 'A', shape: 'ring' },
  { id: 'marker-flip-c', player: 'A', shape: 'marker' },
);
cells[at(0, 1)] = cell({ id: 'ring-move', player: 'A', shape: 'ring' });
cells[at(-1, -1)] = cell({ id: 'ring-far', player: 'B', shape: 'ring' });

const reserves: BoardSnapshot['reserves'] = [];
for (const player of ['A', 'B'] as const) {
  for (let slot = 0; slot < 3; slot++) {
    const pos = yinshRackPosition(player, slot);
    const scored = slot < (player === 'A' ? 2 : 1);
    reserves.push({
      id: `rack-${player}-${slot}`,
      player,
      shape: 'ring',
      pile: slot,
      position: pos,
      count: scored ? 1 : 0,
    });
  }
}

let snapshot: BoardSnapshot = { playableCells: cellCount, cellCount, cells, reserves };

const board = document.querySelector<HTMLDivElement>('#board')!;
let theme: ThemeId = readStoredTheme();
document.documentElement.dataset.theme = theme;

const scene = await createBoardScene(board, {
  gridSize: 11,
  topology,
  pieces,
  initialTheme: theme,
});
scene.setSnapshot(snapshot);

function applyTheme(next: ThemeId) {
  theme = next;
  document.documentElement.dataset.theme = theme;
  storeTheme(theme);
  scene.setTheme(theme);
}

document.querySelector('#theme-toggle')!.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light');
});

function toggleMarkerOwner(id: string) {
  for (const stack of snapshot.cells) {
    const piece = stack.find(p => p.id === id);
    if (piece && piece.shape === 'marker') {
      piece.player = piece.player === 'A' ? 'B' : 'A';
      return;
    }
  }
}

document.querySelector('#flip-demo')!.addEventListener('click', async () => {
  const ids = ['marker-flip-a', 'marker-flip-b', 'marker-flip-c'];
  await scene.flipPieces(ids, 90);
  for (const id of ids) toggleMarkerOwner(id);
  scene.setSnapshot(snapshot);
});

export { scene, applyTheme, snapshot };
