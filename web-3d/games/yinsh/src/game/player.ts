export type Player = 'A' | 'B';

export function nextPlayer(player: Player): Player {
  return player === 'A' ? 'B' : 'A';
}

export function flipPlayer(player: Player): Player {
  return nextPlayer(player);
}
