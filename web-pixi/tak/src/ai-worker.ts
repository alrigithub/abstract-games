import { chooseMove } from "./choose-move";
import type { GameState, Move } from "./engine";

export type AiRequest = {
  id: number;
  game: GameState;
  maxDepth: number;
  maxNodes: number;
};

export type AiResponse = {
  id: number;
  move: Move | null;
  error?: string;
};

self.onmessage = (ev: MessageEvent<AiRequest>) => {
  const { id, game, maxDepth, maxNodes } = ev.data;
  try {
    const move = chooseMove(game, { maxDepth, maxNodes });
    const msg: AiResponse = { id, move };
    self.postMessage(msg);
  } catch (e) {
    const msg: AiResponse = {
      id,
      move: null,
      error: e instanceof Error ? e.message : String(e),
    };
    self.postMessage(msg);
  }
};
