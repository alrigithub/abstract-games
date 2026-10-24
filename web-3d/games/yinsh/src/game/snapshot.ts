import {
  YINSH_COORDS,
  yinshIndex,
  yinshRackPosition,
  type BoardSnapshot,
  type EnginePiece,
  type ReserveSlot,
} from '@abstract/three-engine';
import { coordKey, type Coord } from './coord';
import type { GameState } from './state';
import type { Player } from './player';

const CELL_COUNT = YINSH_COORDS.length;

function ringsOnBoard(state: GameState, player: Player): number {
  return [...state.board.ringCoords(player)].length;
}

function handRingCount(state: GameState, player: Player): number {
  return Math.max(0, 5 - ringsOnBoard(state, player));
}

function handReservePosition(player: Player): { x: number; z: number } {
  const rack0 = yinshRackPosition(player, 0);
  const rack2 = yinshRackPosition(player, 2);
  return { x: rack0.x, z: (rack0.z + rack2.z) / 2 };
}

function buildReserves(state: GameState): ReserveSlot[] {
  const reserves: ReserveSlot[] = [];

  for (const player of ['A', 'B'] as const) {
    const inHand = handRingCount(state, player);
    if (inHand > 0) {
      reserves.push({
        id: `hand-${player}`,
        player,
        shape: 'ring',
        pile: 0,
        position: handReservePosition(player),
        count: inHand,
      });
    }

    const points = player === 'A' ? state.pointsA : state.pointsB;
    for (let slot = 0; slot < 3; slot++) {
      const scored = slot < points;
      reserves.push({
        id: `rack-${player}-${slot}`,
        player,
        shape: 'ring',
        pile: slot + 1,
        position: yinshRackPosition(player, slot),
        count: scored ? 1 : 0,
      });
    }
  }

  return reserves;
}

function pieceId(kind: 'ring' | 'marker', player: Player, coord: Coord): string {
  return `${kind}-${player}-${coordKey(coord)}`;
}

export function gameStateToSnapshot(state: GameState): BoardSnapshot {
  const cells: EnginePiece[][] = Array.from({ length: CELL_COUNT }, () => []);

  const pushAt = (coord: Coord, piece: EnginePiece) => {
    const index = yinshIndex(coord);
    if (index < 0) {
      return;
    }
    cells[index]!.push(piece);
  };

  for (const player of ['A', 'B'] as const) {
    for (const coord of state.board.ringCoords(player)) {
      pushAt(coord, {
        id: pieceId('ring', player, coord),
        player,
        shape: 'ring',
      });
    }
    for (const coord of state.board.markerCoords(player)) {
      pushAt(coord, {
        id: pieceId('marker', player, coord),
        player,
        shape: 'marker',
      });
    }
  }

  return {
    playableCells: CELL_COUNT,
    cellCount: CELL_COUNT,
    cells,
    reserves: buildReserves(state),
  };
}
