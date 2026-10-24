import { chooseAiMove } from './ai';
import { GameState } from './state';
import type { Move } from './state';
import type { Player } from './player';
import { Board } from './board';

interface SerializedState {
  activePlayer: Player;
  turnMode: GameState['turnMode'];
  pointsA: number;
  pointsB: number;
  ringsA: { x: number; y: number }[];
  ringsB: { x: number; y: number }[];
  markersA: { x: number; y: number }[];
  markersB: { x: number; y: number }[];
}

function deserialize(data: SerializedState): GameState {
  const board = Board.empty();
  for (const c of data.ringsA) board.addRing('A', c);
  for (const c of data.ringsB) board.addRing('B', c);
  for (const c of data.markersA) board.addMarker('A', c);
  for (const c of data.markersB) board.addMarker('B', c);
  return new GameState(data.activePlayer, data.turnMode, board, data.pointsA, data.pointsB);
}

function serialize(state: GameState): SerializedState {
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

export type AiRequest = { id: number; state: SerializedState; maxDepth: number };
export type AiResponse = { id: number; move: Move | null };

self.onmessage = (event: MessageEvent<AiRequest>) => {
  const { id, state, maxDepth } = event.data;
  try {
    const game = deserialize(state);
    const move = chooseAiMove(game, maxDepth);
    self.postMessage({ id, move } satisfies AiResponse);
  } catch {
    self.postMessage({ id, move: null } satisfies AiResponse);
  }
};
