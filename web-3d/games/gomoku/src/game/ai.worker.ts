import { chooseMove, type AiOptions } from './ai';
import { legalMoves, type GameState } from './engine';

self.onmessage = (event: MessageEvent<{ id: number; game: GameState; options?: AiOptions }>) => {
  const { id, game, options } = event.data;
  try {
    const move = chooseMove(game, options);
    self.postMessage({ id, move });
  } catch {
    try {
      const moves = legalMoves(game);
      self.postMessage({ id, move: moves[0] ?? null });
    } catch {
      self.postMessage({ id, move: null });
    }
  }
};
