import initWasm, {
  new_game,
  apply_move,
  ai_best_move,
  cancel_ring_selection,
} from "../public/wasm/yinsh_wasm.js";
import wasmUrl from "../public/wasm/yinsh_wasm_bg.wasm?url";

import type { MoveJson, RenderState } from "./types";

let ready: Promise<void> | null = null;

export async function initYinshWasm(): Promise<void> {
  if (!ready) {
    ready = initWasm(wasmUrl).then(() => undefined);
  }
  await ready;
}

function parseRender(json: string): RenderState {
  return JSON.parse(json) as RenderState;
}

function parseMove(json: string): MoveJson {
  return JSON.parse(json) as MoveJson;
}

export async function wasmNewGame(): Promise<RenderState> {
  await initYinshWasm();
  return parseRender(new_game());
}

export async function wasmApplyMove(
  state: RenderState,
  move: MoveJson,
): Promise<RenderState> {
  await initYinshWasm();
  const stateJson = JSON.stringify(state);
  const moveJson = JSON.stringify(move);
  return parseRender(apply_move(stateJson, moveJson));
}

export async function wasmCancelRingSelection(
  state: RenderState,
): Promise<RenderState> {
  await initYinshWasm();
  return parseRender(cancel_ring_selection(JSON.stringify(state)));
}

export async function wasmAiBestMove(
  state: RenderState,
  depth: number,
): Promise<MoveJson> {
  await initYinshWasm();
  return parseMove(ai_best_move(JSON.stringify(state), depth));
}

/** AI-only entry (used from Web Worker after init). */
export function aiBestMoveSync(stateJson: string, depth: number): MoveJson {
  return parseMove(ai_best_move(stateJson, depth));
}

export { initWasm as initWasmRaw };
