import { BoopGame } from './engine';
import './ai';

export type BoopAiRequest = {
  id: number;
  stateExport: string;
  maxDepth: number;
  maxNodes: number;
  timeBudgetMs: number;
};

export type BoopAiResponse = { id: number; moveJson?: string };

self.onmessage = (event: MessageEvent<BoopAiRequest>) => {
  const { id, stateExport, maxDepth, maxNodes, timeBudgetMs } = event.data;
  try {
    const game = BoopGame.import_state(stateExport);
    const moveJson = game.choose_ai_move(maxDepth, maxNodes, timeBudgetMs);
    self.postMessage({ id, moveJson } satisfies BoopAiResponse);
  } catch {
    try {
      const game = BoopGame.import_state(stateExport);
      const raw = game.legal_moves_json();
      const moves = JSON.parse(raw) as unknown[];
      const moveJson = moves[0] ? JSON.stringify(moves[0]) : undefined;
      self.postMessage({ id, moveJson } satisfies BoopAiResponse);
    } catch {
      self.postMessage({ id } satisfies BoopAiResponse);
    }
  }
};
