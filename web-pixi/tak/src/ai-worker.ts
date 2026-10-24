import { chooseMove } from "./choose-move";
import type { GameState, Move } from "./engine";

type AiWorkerRequest = {
  id: number;
  stateJson: string;
  depth: number;
};

type TakAiPayload = {
  game: GameState;
  maxDepth: number;
  maxNodes: number;
};

self.onmessage = (ev: MessageEvent<AiWorkerRequest>) => {
  const { id, stateJson } = ev.data;
  try {
    const { game, maxDepth, maxNodes } = JSON.parse(stateJson) as TakAiPayload;
    const move = chooseMove(game, { maxDepth, maxNodes });
    self.postMessage({
      id,
      moveJson: move ? JSON.stringify(move) : "",
    });
  } catch (e) {
    self.postMessage({
      id,
      moveJson: "",
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
