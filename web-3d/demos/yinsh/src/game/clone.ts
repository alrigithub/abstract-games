import { Board } from './board';
import type { TurnMode } from './state';
import { GameState } from './state';
import type { Player } from './player';

function cloneTurnMode(mode: TurnMode): TurnMode {
  return JSON.parse(JSON.stringify(mode)) as TurnMode;
}

export function cloneGameState(state: GameState): GameState {
  return new GameState(
    state.activePlayer,
    cloneTurnMode(state.turnMode),
    state.board.clone(),
    state.pointsA,
    state.pointsB,
  );
}
