import type {
  AssistGhostHint,
  AssistRingPickGlow,
  AssistRunRowGlow,
  AssistShadowHint,
  BoardAssistState,
} from '@abstract/three-engine';
import type { AiMoveHighlight } from './ai-move-highlight';
import type { Board } from './board';
import { coordEq, type Coord } from './coord';
import {
  allRunOptions,
  listRunOptions,
  pendingRunOptions,
  type RunOption,
} from './runs';
import { markerIdsOnRingMove } from './visual';
import type { GameState } from './state';
import type { Player } from './player';
import { ringDestinationCoords } from './ring-destinations';
import { coordToIndex, indexToCoord } from './cells';
import {
  YINSH_ASSIST_DOT_RADIUS,
  YINSH_MARKER_WORLD_RADIUS,
  YINSH_RING_FOOTPRINT,
} from '../yinsh-piece-models';

export type { AiMoveHighlight };

function indices(coords: Coord[]): number[] {
  return coords.map(coordToIndex);
}

function markerGhostRadius(): number {
  return YINSH_MARKER_WORLD_RADIUS * 0.96;
}

function markerGhostAt(cell: number, player: Player, strong: boolean): AssistGhostHint {
  return {
    cell,
    player,
    marker: { radius: markerGhostRadius() },
    strength: strong ? 'strong' : 'normal',
  };
}

function markerPlayerAt(board: Board, coord: Coord): Player | undefined {
  for (const p of ['A', 'B'] as const) {
    for (const c of board.markerCoords(p)) {
      if (coordEq(c, coord)) return p;
    }
  }
  return undefined;
}

function ringGhostAt(cell: number, player: Player, board: Board, coord: Coord): AssistGhostHint {
  const ghost: AssistGhostHint = {
    cell,
    player,
    ring: YINSH_RING_FOOTPRINT,
    strength: 'normal',
  };
  if (markerPlayerAt(board, coord)) {
    ghost.marker = { radius: markerGhostRadius() };
  }
  return ghost;
}

function aiLastMoveAssist(last: AiMoveHighlight, aiPlayer: Player): Pick<BoardAssistState, 'ghosts'> {
  return {
    ghosts: [
      {
        cell: last.fromCell,
        player: aiPlayer,
        ring: YINSH_RING_FOOTPRINT,
        strength: 'normal',
      },
    ],
  };
}

function runGlowRows(
  options: RunOption[],
  hoverCell: number | null,
  mode: 'announce' | 'pick',
): AssistRunRowGlow[] {
  let hoverOption: RunOption | undefined;
  if (hoverCell !== null && mode === 'pick') {
    const hover = indexToCoord(hoverCell);
    hoverOption =
      options.find(o => coordEq(o.seed, hover)) ??
      options.find(o => o.five.some(c => coordEq(c, hover)));
  }

  const rows: AssistRunRowGlow[] = [];
  for (const option of options) {
    const strength =
      mode === 'announce' ? 'announce' : option === hoverOption ? 'hover' : 'option';
    rows.push({
      markerCells: indices(option.five),
      highlightCells: option === hoverOption ? indices(option.five) : undefined,
      strength,
    });
  }
  return rows;
}

function buildRunAndRingGlows(
  state: GameState,
  hoverCell: number | null,
): Pick<BoardAssistState, 'runGlows' | 'ringPickGlows'> {
  const mode = state.turnMode.tag;
  const out: Pick<BoardAssistState, 'runGlows' | 'ringPickGlows'> = {};

  if (mode === 'WaitForRunRemoval') {
    const pending = pendingRunOptions(state);
    if (pending.length) out.runGlows = runGlowRows(pending, hoverCell, 'announce');
  }

  if (mode === 'RunRemoval') {
    const options = listRunOptions(state.board, state.activePlayer);
    if (options.length) out.runGlows = runGlowRows(options, hoverCell, 'pick');
  }

  if (mode === 'RingRemoval' || mode === 'WaitForRingRemoval') {
    const rings = [...state.board.ringCoords(state.activePlayer)];
    out.ringPickGlows = rings.map(coord => {
      const cell = coordToIndex(coord);
      const hover = hoverCell !== null && cell === hoverCell;
      return { cell, strength: hover ? 'hover' : 'option' };
    });
  }

  return out;
}

export function buildYinshAssist(
  state: GameState,
  options: {
    humanPlayer: Player;
    aiPlayer: Player;
    humanTurn: boolean;
    ringMoveStart: Coord | null;
    hoverCell: number | null;
    lastAiMove: AiMoveHighlight | null;
    ringStartWorld?: { x: number; z: number } | null;
  },
): BoardAssistState | null {
  const runGlowState = buildRunAndRingGlows(state, options.hoverCell);

  if (!options.humanTurn) {
    const assist: BoardAssistState = {
      destinationDotRadius: YINSH_ASSIST_DOT_RADIUS,
      runGlowStyle: { markerRadius: YINSH_MARKER_WORLD_RADIUS, haloScale: 1.4 },
      markerGhostRadius: markerGhostRadius(),
      ...runGlowState,
    };
    if (options.lastAiMove) {
      const ai = aiLastMoveAssist(options.lastAiMove, options.aiPlayer);
      assist.ghosts = ai.ghosts;
    }
    if (!assist.runGlows?.length && !assist.ringPickGlows?.length && !assist.ghosts?.length) return null;
    return assist;
  }

  const mode = state.turnMode;
  const board = state.board;
  const assist: BoardAssistState = {
    destinationDotRadius: YINSH_ASSIST_DOT_RADIUS,
    runGlowStyle: { markerRadius: YINSH_MARKER_WORLD_RADIUS, haloScale: 1.4 },
    markerGhostRadius: markerGhostRadius(),
    shadows: [],
    ghosts: [],
    ...runGlowState,
  };

  if (options.lastAiMove) {
    const ai = aiLastMoveAssist(options.lastAiMove, options.aiPlayer);
    assist.ghosts!.push(...(ai.ghosts ?? []));
  }

  const shadows: AssistShadowHint[] = assist.shadows ? [...assist.shadows] : [];
  const ghosts: AssistGhostHint[] = assist.ghosts ? [...assist.ghosts] : [];

  switch (mode.tag) {
    case 'RingPlacement': {
      const legal = [...board.freeCoords()];
      assist.destinationCells = indices(legal);
      if (options.hoverCell !== null) {
        const hover = indexToCoord(options.hoverCell);
        if (legal.some(c => coordEq(c, hover))) {
          shadows.push({
            cell: options.hoverCell,
            footprint: YINSH_RING_FOOTPRINT,
            strength: 'hover',
          });
        }
      }
      break;
    }

    case 'MarkerPlacement': {
      const pickable = [...board.markerMoves(state.activePlayer)];
      for (const coord of pickable) {
        const cell = coordToIndex(coord);
        const strong =
          options.hoverCell !== null && coordEq(indexToCoord(options.hoverCell), coord);
        ghosts.push(markerGhostAt(cell, state.activePlayer, strong));
      }
      break;
    }

    case 'RingMovement': {
      const start = options.ringMoveStart ?? mode.start;
      const startCell = coordToIndex(start);
      const destCoords = ringDestinationCoords(board, start);
      assist.destinationCells = indices(destCoords);
      ghosts.push({
        ...ringGhostAt(startCell, state.activePlayer, board, start),
        strength: 'strong',
      });

      if (options.hoverCell !== null) {
        const hover = indexToCoord(options.hoverCell);
        if (destCoords.some(c => coordEq(c, hover))) {
          assist.flipPieceIds = markerIdsOnRingMove(board, start, hover);
          shadows.push({
            cell: options.hoverCell,
            footprint: YINSH_RING_FOOTPRINT,
            strength: 'hover',
          });
        }
      }
      break;
    }

    case 'RunRemoval': {
      const seeds = board.runSeeds(state.activePlayer);
      assist.pickableCells = indices(seeds);
      break;
    }

    case 'RingRemoval': {
      const rings = [...board.ringCoords(state.activePlayer)];
      assist.pickableCells = indices(rings);
      break;
    }

    default:
      break;
  }

  if (shadows.length) assist.shadows = shadows;
  else delete assist.shadows;
  if (ghosts.length) assist.ghosts = ghosts;
  else delete assist.ghosts;

  return assist;
}

/** Rows currently scoring on the board (for tests / diagnostics). */
export function visibleRunOptions(state: GameState) {
  return allRunOptions(state.board);
}
