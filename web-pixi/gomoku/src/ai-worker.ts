import type { AiWorkerRequest } from "@abstract/pixi-shared";
import { chooseAiMove } from "./ai";
import type { Board } from "./engine";

type AiWorkerIn = { id: number; board: Board; gameId: number };
self.onmessage = (ev: MessageEvent<AiWorkerRequest>) => {
  const { id, stateJson } = ev.data;
  try {
    const payload = JSON.parse(stateJson) as AiWorkerIn;
    const move = chooseAiMove(payload.board, "white");
    self.postMessage({ id, moveJson: JSON.stringify(move) });
  } catch (e) {
    self.postMessage({
      id,
      moveJson: "",
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
