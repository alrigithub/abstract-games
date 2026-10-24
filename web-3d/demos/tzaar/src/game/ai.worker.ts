import { chooseAiMove, quickLegalMove, type TzaarAiOptions } from './ai';
import { gameFromAiWorker, type SerializedTzaarState } from './state';

export type TzaarAiRequest = {
  id: number;
  state: SerializedTzaarState;
  maxDepth: number;
  maxNodes: number;
  timeBudgetMs: number;
};

export type TzaarAiResponse = { id: number; move: import('./state').Move | null };

self.onmessage = (event: MessageEvent<TzaarAiRequest>) => {
  const { id, state, maxDepth, maxNodes, timeBudgetMs } = event.data;
  const options: TzaarAiOptions = { maxDepth, maxNodes, maxTimeMs: timeBudgetMs };
  try {
    const game = gameFromAiWorker(state);
    const move = chooseAiMove(game, options) ?? quickLegalMove(game);
    self.postMessage({ id, move } satisfies TzaarAiResponse);
  } catch {
    try {
      const game = gameFromAiWorker(state);
      self.postMessage({ id, move: quickLegalMove(game) } satisfies TzaarAiResponse);
    } catch {
      self.postMessage({ id, move: null } satisfies TzaarAiResponse);
    }
  }
};
