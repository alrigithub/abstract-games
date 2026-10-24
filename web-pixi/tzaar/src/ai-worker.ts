import initWasm, { ai_best_move } from "../public/wasm/tzaar_wasm.js";
import wasmUrl from "../public/wasm/tzaar_wasm_bg.wasm?url";

let initPromise: Promise<void> | null = null;

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = initWasm(wasmUrl).then(() => undefined);
  }
  await initPromise;
}

export type AiRequest = {
  id: number;
  stateJson: string;
  depth: number;
};

export type AiResponse = {
  id: number;
  moveJson: string;
  error?: string;
};

self.onmessage = async (ev: MessageEvent<AiRequest>) => {
  const { id, stateJson, depth } = ev.data;
  try {
    await ensureInit();
    const moveJson = ai_best_move(stateJson, depth);
    const msg: AiResponse = { id, moveJson };
    self.postMessage(msg);
  } catch (e) {
    const msg: AiResponse = {
      id,
      moveJson: "",
      error: e instanceof Error ? e.message : String(e),
    };
    self.postMessage(msg);
  }
};
