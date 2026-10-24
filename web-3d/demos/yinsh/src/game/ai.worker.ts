import { chooseAiMove, quickLegalMove, type YinshAiOptions } from './ai';
import { possibleMoves } from './moves';
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

export type AiRequest = {
  id: number;
  state: SerializedState;
  maxDepth: number;
  maxNodes: number;
  timeBudgetMs: number;
};
export type AiResponse = { id: number; move: Move | null };

self.onmessage = (event: MessageEvent<AiRequest>) => {
  const { id, state, maxDepth, maxNodes, timeBudgetMs } = event.data;
  const options: YinshAiOptions = { maxDepth, maxNodes, maxTimeMs: timeBudgetMs };
  try {
    const game = deserialize(state);
    const move = chooseAiMove(game, options) ?? quickLegalMove(game);
    self.postMessage({ id, move } satisfies AiResponse);
  } catch {
    try {
      const game = deserialize(state);
      self.postMessage({ id, move: quickLegalMove(game) } satisfies AiResponse);
    } catch {
      self.postMessage({ id, move: null } satisfies AiResponse);
    }
  }
};
