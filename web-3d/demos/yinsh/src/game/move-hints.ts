import type { BoardAssistState } from '@abstract/three-engine';
import type { Board } from './board';
import { coordEq, type Coord } from './coord';
import { markerIdsOnRingMove } from './visual';
import type { GameState } from './state';
import type { Player } from './player';
import { ringDestinationCoords, ringPathCoords } from './ring-destinations';
import { coordToIndex, indexToCoord } from './cells';

export type AiMoveHighlight = {
  fromCell: number;
  toCell: number;
  pathCells: number[];
  flipPieceIds: string[];
};

function indices(coords: Coord[]): number[] {
  return coords.map(coordToIndex);
}

function runHighlightCells(board: Board, seed: Coord): number[] {
  const run = board.runCoordsFrom(seed);
  return run ? indices(run) : indices([seed]);
}

export function buildYinshAssist(
  state: GameState,
  options: {
    humanPlayer: Player;
    humanTurn: boolean;
    ringMoveStart: Coord | null;
    hoverCell: number | null;
    lastAiMove: AiMoveHighlight | null;
  },
): BoardAssistState | null {
  if (!options.humanTurn) {
    if (options.lastAiMove) {
      return {
        lastMove: {
          fromCell: options.lastAiMove.fromCell,
          toCell: options.lastAiMove.toCell,
          pathCells: options.lastAiMove.pathCells,
        },
      };
    }
    return null;
  }

  const mode = state.turnMode;
  const board = state.board;
  const assist: BoardAssistState = {};

  if (options.lastAiMove) {
    assist.lastMove = {
      fromCell: options.lastAiMove.fromCell,
      toCell: options.lastAiMove.toCell,
      pathCells: options.lastAiMove.pathCells,
    };
  }

  if (options.hoverCell !== null) assist.hoverCell = options.hoverCell;

  switch (mode.tag) {
    case 'RingPlacement':
      assist.destinationCells = indices([...board.freeCoords()]);
      break;

    case 'MarkerPlacement': {
      const pickable = [...board.markerMoves(state.activePlayer)];
      assist.pickableCells = indices(pickable);
      break;
    }

    case 'RingMovement': {
      const start = options.ringMoveStart ?? mode.start;
      assist.selectedCell = coordToIndex(start);
      const destCoords = ringDestinationCoords(board, start);
      assist.destinationCells = indices(destCoords);
      if (options.hoverCell !== null) {
        const hover = indexToCoord(options.hoverCell);
        if (destCoords.some(c => coordEq(c, hover))) {
          assist.pathCells = indices(ringPathCoords(start, hover));
          assist.flipPieceIds = markerIdsOnRingMove(board, start, hover);
        }
      }
      break;
    }

    case 'RunRemoval': {
      const seeds = board.runSeeds(state.activePlayer);
      assist.pickableCells = indices(seeds);
      assist.highlightCells = indices(seeds);
      if (options.hoverCell !== null) {
        const hover = indexToCoord(options.hoverCell);
        if (seeds.some(c => coordEq(c, hover))) {
          assist.highlightCells = runHighlightCells(board, hover);
        }
      }
      break;
    }

    case 'RingRemoval': {
      const rings = [...board.ringCoords(state.activePlayer)];
      assist.pickableCells = indices(rings);
      assist.highlightCells = indices(rings);
      break;
    }

    default:
      break;
  }

  return assist;
}
