import init, { BoopGame } from '../../wasm/boop_wasm.js';

export type BoopAiRequest = {
  id: number;
  stateExport: string;
  maxDepth: number;
  maxNodes: number;
  timeBudgetMs: number;
};

export type BoopAiResponse = { id: number; moveJson?: string };

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
    self.postMessage({ id, moveJson } satisfies BoopAiResponse);
  } catch {
    self.postMessage({ id } satisfies BoopAiResponse);
  }
};
