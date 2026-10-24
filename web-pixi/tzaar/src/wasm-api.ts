import initWasm, {
  new_game,
  apply_move,
} from "../public/wasm/tzaar_wasm.js";
import wasmUrl from "../public/wasm/tzaar_wasm_bg.wasm?url";

import type { MoveJson, RenderState } from "./types";

let ready: Promise<void> | null = null;

export async function initTzaarWasm(): Promise<void> {
  if (!ready) {
    ready = initWasm(wasmUrl).then(() => undefined);
  }
  await ready;
}

function parseRender(json: string): RenderState {
  return JSON.parse(json) as RenderState;
}

export async function wasmNewGame(): Promise<RenderState> {
  await initTzaarWasm();
  return parseRender(new_game());
}

export async function wasmApplyMove(
  state: RenderState,
  move: MoveJson,
): Promise<RenderState> {
  await initTzaarWasm();
  return parseRender(
    apply_move(JSON.stringify(state), JSON.stringify(move)),
  );
}

export { initWasm as initWasmRaw };
