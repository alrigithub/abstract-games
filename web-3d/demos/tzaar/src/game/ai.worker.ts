import { chooseAiMove, quickLegalMove, type TzaarAiOptions } from './ai';
import { gameFromAiWorker, type SerializedTzaarState } from './state';

export type TzaarAiRequest = {
  id: number;
  state: SerializedTzaarState;
  maxDepth: number;
  maxNodes: number;
  timeBudgetMs: number;
};

export type TzaarAiResponse = {
  id: number;
  move: import('./state').Move | null;
  source: 'search' | 'fallback';
};

self.onmessage = (event: MessageEvent<TzaarAiRequest>) => {
  const { id, state, maxDepth, maxNodes, timeBudgetMs } = event.data;
  const options: TzaarAiOptions = { maxDepth, maxNodes, maxTimeMs: timeBudgetMs };
  try {
    const game = gameFromAiWorker(state);
    const move = chooseAiMove(game, options);
    if (move) {
      self.postMessage({ id, move, source: 'search' } satisfies TzaarAiResponse);
      return;
    }
    self.postMessage({ id, move: quickLegalMove(game), source: 'fallback' } satisfies TzaarAiResponse);
  } catch {
    try {
      const game = gameFromAiWorker(state);
      self.postMessage({ id, move: quickLegalMove(game), source: 'fallback' } satisfies TzaarAiResponse);
    } catch {
      self.postMessage({ id, move: null, source: 'fallback' } satisfies TzaarAiResponse);
    }
  }
};
