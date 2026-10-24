import { chooseAiMove, quickLegalMove, type TzaarAiOptions } from './ai';
import type { GameState } from './state';

export type TzaarAiRequest = {
  id: number;
  game: GameState;
  maxDepth: number;
  maxNodes: number;
  timeBudgetMs: number;
};

export type TzaarAiResponse = { id: number; move: import('./state').Move | null };

self.onmessage = (event: MessageEvent<TzaarAiRequest>) => {
  const { id, game, maxDepth, maxNodes, timeBudgetMs } = event.data;
  const options: TzaarAiOptions = { maxDepth, maxNodes, maxTimeMs: timeBudgetMs };
  try {
    const move = chooseAiMove(game, options) ?? quickLegalMove(game);
    self.postMessage({ id, move } satisfies TzaarAiResponse);
  } catch {
    try {
      self.postMessage({ id, move: quickLegalMove(game) } satisfies TzaarAiResponse);
    } catch {
      self.postMessage({ id, move: null } satisfies TzaarAiResponse);
    }
  }
};
