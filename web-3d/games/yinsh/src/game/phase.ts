import type { GameState } from './state';
import type { Player } from './player';

export function phaseLabel(state: GameState): string {
  switch (state.turnMode.tag) {
    case 'RingPlacement':
      return 'Place a ring';
    case 'MarkerPlacement':
      return 'Drop a marker in a ring';
    case 'WaitForRingMovement':
    case 'RingMovement':
      return 'Move a ring';
    case 'WaitForRunRemoval':
      return 'Five in a row!';
    case 'RunRemoval':
      return 'Click a row to remove five markers';
    case 'WaitForRingRemoval':
    case 'RingRemoval':
      return 'Five in a row! Remove a ring';
    case 'WaitForMarkerPlacement':
      return 'Continue';
    default:
      return 'Play';
  }
}

export function statusLine(state: GameState, human: Player, aiStrengthLabel: string, extra?: string): string {
  const winner = state.winner();
  if (winner) {
    const who = winner === human ? 'You win' : 'AI wins';
    return `${who} · ${aiStrengthLabel}`;
  }
  const turn = state.activePlayer === human ? 'Your turn' : 'AI thinking…';
  const phase = phaseLabel(state);
  const score = `Rings scored · You ${human === 'A' ? state.pointsA : state.pointsB} · AI ${human === 'A' ? state.pointsB : state.pointsA}`;
  if (extra) return `${extra} · ${turn} · ${phase} · ${score} · AI ${aiStrengthLabel}`;
  return `${turn} · ${phase} · ${score} · AI ${aiStrengthLabel}`;
}
