import {
  YINSH_COORDS,
  createBoardScene,
  createGameButtons,
  DEFAULT_LOBBY_HREF,
  createYinshMarkerGeometry,
  createYinshRingGeometry,
  createYinshTopology,
  readInitialTheme,
  yinshIndex,
  yinshPieceGeometrySet,
  yinshRackPosition,
  type BoardSnapshot,
  type EnginePiece,
  type ThemeId,
} from '@abstract/three-engine';

const cellCount = YINSH_COORDS.length;
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

function buildDemoSnapshot(): BoardSnapshot {
  const cells: EnginePiece[][] = Array.from({ length: cellCount }, () => []);

  cells[at(-2, 1)] = cell(
    { id: 'ring-w0', player: 'A', shape: 'ring' },
    { id: 'marker-center', player: 'A', shape: 'marker' },
  );
  cells[at(-1, 1)] = cell({ id: 'ring-b0', player: 'B', shape: 'ring' });
  cells[at(0, 1)] = cell(
    { id: 'ring-w1', player: 'A', shape: 'ring' },
    { id: 'marker-flip-a', player: 'A', shape: 'marker' },
  );
  cells[at(1, 1)] = cell(
    { id: 'ring-b1', player: 'B', shape: 'ring' },
    { id: 'marker-flip-b', player: 'B', shape: 'marker' },
  );
  cells[at(2, 1)] = cell(
    { id: 'ring-w2', player: 'A', shape: 'ring' },
    { id: 'marker-flip-c', player: 'A', shape: 'marker' },
  );
  cells[at(0, 0)] = cell({ id: 'ring-solo', player: 'B', shape: 'ring' });
  cells[at(-1, 0)] = cell({ id: 'ring-a-solo', player: 'A', shape: 'ring' });

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

  return { playableCells: cellCount, cellCount, cells, reserves };
}

let snapshot: BoardSnapshot = buildDemoSnapshot();

const board = document.querySelector<HTMLDivElement>('#board')!;
let theme: ThemeId = readInitialTheme();

const scene = await createBoardScene(board, {
  gridSize: 11,
  topology,
  pieces,
  initialTheme: theme,
});
scene.setSnapshot(snapshot);

function applyTheme(next: ThemeId) {
  theme = next;
  scene.setTheme(theme);
}


function renderStatus(extra?: string) {
  gameButtons.setStatus(extra ?? 'Piece showcase — rings, GIPF chips, scored racks (no 3D AI yet)');
}

const gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  lobbyHref: DEFAULT_LOBBY_HREF,
  applyTheme,
  onNewGameReset: () => {
    snapshot = buildDemoSnapshot();
    scene.setSnapshot(snapshot);
    renderStatus('Demo layout reset');
  },
  extraButtons: [{ label: 'Flip run', testId: 'flip-demo', onClick: () => void flipRun() }],
});


renderStatus();

function toggleMarkerOwner(id: string) {
  for (const stack of snapshot.cells) {
    const piece = stack.find(p => p.id === id);
    if (piece && piece.shape === 'marker') {
      piece.player = piece.player === 'A' ? 'B' : 'A';
      return;
    }
  }
}

async function flipRun() {
  const ids = ['marker-flip-a', 'marker-flip-b', 'marker-flip-c'];
  await scene.flipPieces(ids, 90);
  for (const id of ids) toggleMarkerOwner(id);
  scene.setSnapshot(snapshot);
  renderStatus('Markers flipped');
}

export { scene, applyTheme, snapshot };
