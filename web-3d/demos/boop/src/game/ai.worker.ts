import init, { BoopGame } from '../../wasm/boop_wasm.js';

export type BoopAiRequest = {
  id: number;
  stateExport: string;
  maxDepth: number;
  maxNodes: number;
  timeBudgetMs: number;
};

export type BoopAiResponse = {
  id: number;
  moveJson?: string;
  source: 'search' | 'fallback';
};

let wasmReady: Promise<void> | null = null;

function ensureWasm() {
  wasmReady ??= init();
  return wasmReady;
}

self.onmessage = async (event: MessageEvent<BoopAiRequest>) => {
  const { id, stateExport, maxDepth, maxNodes, timeBudgetMs } = event.data;
  try {
    await ensureWasm();
    const game = BoopGame.import_state(stateExport);
    const moveJson = game.choose_ai_move(maxDepth, maxNodes, timeBudgetMs);
    if (moveJson) {
      self.postMessage({ id, moveJson, source: 'search' } satisfies BoopAiResponse);
      return;
    }
  } catch {
    /* fall through to legal-move fallback */
  }
  try {
    await ensureWasm();
    const game = BoopGame.import_state(stateExport);
    const raw = game.legal_moves_json();
    const moves = JSON.parse(raw) as unknown[];
    const moveJson = moves[0] ? JSON.stringify(moves[0]) : undefined;
    self.postMessage({ id, moveJson, source: 'fallback' } satisfies BoopAiResponse);
  } catch {
    self.postMessage({ id, source: 'fallback' } satisfies BoopAiResponse);
  }
};
