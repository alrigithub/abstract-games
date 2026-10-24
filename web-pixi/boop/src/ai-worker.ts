import { chooseMove } from "./ai/choose-move";
import type { BoopGameState } from "./engine/types";

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

self.onmessage = (ev: MessageEvent<AiRequest>) => {
  const { id, stateJson } = ev.data;
  try {
    const state = JSON.parse(stateJson) as BoopGameState;
    const move = chooseMove(state);
    const msg: AiResponse = {
      id,
      moveJson: move ? JSON.stringify(move) : "",
    };
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
