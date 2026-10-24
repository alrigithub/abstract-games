import type { GameState } from './state';
import type { AiRequest } from './ai.worker';

export function serializeForWorker(state: GameState): AiRequest['state'] {
  return {
    activePlayer: state.activePlayer,
    turnMode: state.turnMode,
    pointsA: state.pointsA,
    pointsB: state.pointsB,
    ringsA: [...state.board.ringCoords('A')],
    ringsB: [...state.board.ringCoords('B')],
    markersA: [...state.board.markerCoords('A')],
    markersB: [...state.board.markerCoords('B')],
  };
}
