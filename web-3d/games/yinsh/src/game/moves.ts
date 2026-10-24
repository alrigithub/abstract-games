import { coordEq } from './coord';
import type { GameState, Move, TurnMode } from './state';

export function possibleMoves(state: GameState): Move[] {
  const mode = state.turnMode;

  switch (mode.tag) {
    case 'RingPlacement':
      return [...state.board.freeCoords()].map(coord => ({ tag: 'PlaceRing', coord }));

    case 'MarkerPlacement':
      return [...state.board.markerMoves(state.activePlayer)].map(coord => ({
        tag: 'PlaceMarker',
        coord,
      }));

    case 'RingMovement':
      return state.board.ringMoves(mode.start).map(end => ({
        tag: 'MoveRing',
        start: mode.start,
        end,
      }));

    case 'RunRemoval':
      return state.board.runSeeds(state.activePlayer).map(coord => ({
        tag: 'RemoveRun',
        coord,
      }));

    case 'RingRemoval':
      return [...state.board.ringCoords(state.activePlayer)].map(coord => ({
        tag: 'RemoveRing',
        coord,
      }));

    case 'WaitForRunRemoval':
    case 'WaitForMarkerPlacement':
    case 'WaitForRingMovement':
    case 'WaitForRingRemoval':
      return [{ tag: 'Wait' }];

    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function turnModeKey(mode: TurnMode): string {
  return JSON.stringify(mode);
}

export function moveKey(move: Move): string {
  return JSON.stringify(move);
}

export function movesInclude(moves: Move[], target: Move): boolean {
  return moves.some(m => moveEquals(m, target));
}

function moveEquals(a: Move, b: Move): boolean {
  if (a.tag !== b.tag) {
    return false;
  }
  switch (a.tag) {
    case 'PlaceRing':
      return b.tag === 'PlaceRing' && coordEq(a.coord, b.coord);
    case 'PlaceMarker':
      return b.tag === 'PlaceMarker' && coordEq(a.coord, b.coord);
    case 'MoveRing':
      return b.tag === 'MoveRing' && coordEq(a.start, b.start) && coordEq(a.end, b.end);
    case 'RemoveRun':
      return b.tag === 'RemoveRun' && coordEq(a.coord, b.coord);
    case 'RemoveRing':
      return b.tag === 'RemoveRing' && coordEq(a.coord, b.coord);
    case 'Wait':
      return b.tag === 'Wait';
    default:
      return false;
  }
}
