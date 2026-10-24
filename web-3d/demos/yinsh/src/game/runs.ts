import type { Board } from './board';
import { coordEq, type Coord } from './coord';
import type { Player } from './player';
import type { GameState } from './state';

export type RunOption = {
  seed: Coord;
  player: Player;
  /** Exactly five markers removed when this seed is chosen. */
  five: Coord[];
  /** Full contiguous chain (may be longer than five). */
  chain: Coord[];
};

function canonicalKey(coords: Coord[]): string {
  return [...coords]
    .sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y))
    .map(c => `${c.x},${c.y}`)
    .join('|');
}

export function listRunOptions(board: Board, player: Player): RunOption[] {
  const out: RunOption[] = [];
  const seenFive = new Set<string>();

  for (const seed of board.runSeeds(player)) {
    const five = board.runCoordsFrom(seed);
    const chain = board.markerChainFrom(seed);
    if (!five || !chain) continue;
    const key = canonicalKey(five);
    if (seenFive.has(key)) continue;
    seenFive.add(key);
    out.push({ seed, player, five, chain });
  }
  return out;
}

/** All run rows currently on the board for either player (for glow overlays). */
export function allRunOptions(board: Board): RunOption[] {
  const out: RunOption[] = [];
  for (const player of ['A', 'B'] as const) {
    out.push(...listRunOptions(board, player));
  }
  return out;
}

export function runOptionsForActiveRemoval(state: GameState): RunOption[] {
  if (state.turnMode.tag !== 'RunRemoval') return [];
  return listRunOptions(state.board, state.activePlayer);
}

export function pendingRunOptions(state: GameState): RunOption[] {
  const mode = state.turnMode.tag;
  if (mode === 'RunRemoval') {
    return runOptionsForActiveRemoval(state);
  }
  if (mode === 'WaitForRunRemoval') {
    return allRunOptions(state.board);
  }
  return [];
}

export function runOptionForHover(board: Board, player: Player, hover: Coord): RunOption | undefined {
  return listRunOptions(board, player).find(o => coordEq(o.seed, hover));
}
