import { chooseMove, type AiOptions } from './ai';
import type { GameState } from './engine';
self.onmessage = (event: MessageEvent<{ id: number; game: GameState; options?: AiOptions }>) => {
  const { id, game, options } = event.data;
  self.postMessage({ id, move: chooseMove(game, options) });
};
