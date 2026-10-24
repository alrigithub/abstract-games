import { Board, checkRunResultHasRun } from './board';
import { coordEq, type Coord } from './coord';
import { flipPlayer, nextPlayer, type Player } from './player';

export type TurnMode =
  | { tag: 'RingPlacement' }
  | { tag: 'MarkerPlacement' }
  | { tag: 'WaitForRingMovement'; start: Coord }
  | { tag: 'RingMovement'; start: Coord }
  | { tag: 'RunRemoval'; playerLastRingMove: Player }
  | { tag: 'WaitForRunRemoval'; playerLastRingMove: Player }
  | { tag: 'RingRemoval'; playerLastRingMove: Player }
  | { tag: 'WaitForRingRemoval'; playerLastRingMove: Player }
  | { tag: 'WaitForMarkerPlacement' };

export type Move =
  | { tag: 'PlaceRing'; coord: Coord }
  | { tag: 'PlaceMarker'; coord: Coord }
  | { tag: 'MoveRing'; start: Coord; end: Coord }
  | { tag: 'RemoveRun'; coord: Coord }
  | { tag: 'RemoveRing'; coord: Coord }
  | { tag: 'Wait' };

export class GameState {
  activePlayer: Player;
  turnMode: TurnMode;
  board: Board;
  pointsA: number;
  pointsB: number;

  constructor(
    activePlayer: Player,
    turnMode: TurnMode,
    board: Board,
    pointsA: number,
    pointsB: number,
  ) {
    this.activePlayer = activePlayer;
    this.turnMode = turnMode;
    this.board = board;
    this.pointsA = pointsA;
    this.pointsB = pointsB;
  }

  static initial(): GameState {
    return new GameState('A', { tag: 'RingPlacement' }, Board.empty(), 0, 0);
  }

  performMove(playerMove: Move): void {
    const mode = this.turnMode;

    switch (mode.tag) {
      case 'RingPlacement':
        if (playerMove.tag !== 'PlaceRing') {
          throw unexpectedMove(mode, playerMove);
        }
        this.board.addRing(this.activePlayer, playerMove.coord);
        this.turnMode =
          this.board.numRings() <= 9 ? { tag: 'RingPlacement' } : { tag: 'MarkerPlacement' };
        break;

      case 'MarkerPlacement':
        if (playerMove.tag !== 'PlaceMarker') {
          throw unexpectedMove(mode, playerMove);
        }
        this.board.removeRing(playerMove.coord);
        this.board.addMarker(this.activePlayer, playerMove.coord);
        this.turnMode = { tag: 'WaitForRingMovement', start: playerMove.coord };
        break;

      case 'WaitForRingMovement':
        if (playerMove.tag !== 'Wait') {
          throw unexpectedMove(mode, playerMove);
        }
        this.turnMode = { tag: 'RingMovement', start: mode.start };
        break;

      case 'RingMovement':
        if (playerMove.tag !== 'MoveRing') {
          throw unexpectedMove(mode, playerMove);
        }
        this.board.addRing(this.activePlayer, playerMove.end);
        this.board.flipMarkersBetween(playerMove.start, playerMove.end);

        {
          const result = this.board.checkRun();
          if (checkRunResultHasRun(result, this.activePlayer)) {
            this.turnMode = { tag: 'WaitForRunRemoval', playerLastRingMove: this.activePlayer };
          } else if (checkRunResultHasRun(result, nextPlayer(this.activePlayer))) {
            this.turnMode = { tag: 'RunRemoval', playerLastRingMove: this.activePlayer };
          } else {
            this.turnMode = { tag: 'MarkerPlacement' };
          }
        }
        break;

      case 'WaitForRunRemoval':
        if (playerMove.tag !== 'Wait') {
          throw unexpectedMove(mode, playerMove);
        }
        this.turnMode = { tag: 'RunRemoval', playerLastRingMove: mode.playerLastRingMove };
        break;

      case 'RunRemoval':
        if (playerMove.tag !== 'RemoveRun') {
          throw unexpectedMove(mode, playerMove);
        }
        this.board.removeRun(playerMove.coord);
        if (this.activePlayer === 'A') {
          this.pointsA += 1;
        } else {
          this.pointsB += 1;
        }
        this.turnMode = { tag: 'WaitForRingRemoval', playerLastRingMove: mode.playerLastRingMove };
        break;

      case 'WaitForRingRemoval':
        if (playerMove.tag !== 'Wait') {
          throw unexpectedMove(mode, playerMove);
        }
        this.turnMode = { tag: 'RingRemoval', playerLastRingMove: mode.playerLastRingMove };
        break;

      case 'RingRemoval':
        if (playerMove.tag !== 'RemoveRing') {
          throw unexpectedMove(mode, playerMove);
        }
        this.board.removeRing(playerMove.coord);
        {
          const result = this.board.checkRun();
          const last = mode.playerLastRingMove;
          if (checkRunResultHasRun(result, this.activePlayer)) {
            this.turnMode = { tag: 'WaitForRunRemoval', playerLastRingMove: last };
          } else if (checkRunResultHasRun(result, nextPlayer(this.activePlayer))) {
            this.turnMode = { tag: 'RunRemoval', playerLastRingMove: last };
          } else if (this.activePlayer === last) {
            this.turnMode = { tag: 'MarkerPlacement' };
          } else {
            this.turnMode = { tag: 'WaitForMarkerPlacement' };
          }
        }
        break;

      case 'WaitForMarkerPlacement':
        if (playerMove.tag !== 'Wait') {
          throw unexpectedMove(mode, playerMove);
        }
        this.turnMode = { tag: 'MarkerPlacement' };
        break;

      default: {
        const _exhaustive: never = mode;
        throw unexpectedMove(_exhaustive, playerMove);
      }
    }

    this.activePlayer = flipPlayer(this.activePlayer);
  }

  winner(): Player | undefined {
    if (this.pointsA >= 3) {
      return 'A';
    }
    if (this.pointsB >= 3) {
      return 'B';
    }
    return undefined;
  }
}

function unexpectedMove(mode: TurnMode, move: Move): Error {
  return new Error(`Received unexpected player move ${JSON.stringify(move)} in mode ${JSON.stringify(mode)}`);
}

/** Test helper: compare coords in moves */
export function moveRingEnd(move: Move): Coord | undefined {
  return move.tag === 'MoveRing' ? move.end : undefined;
}

export function coordsEqual(a: Coord, b: Coord): boolean {
  return coordEq(a, b);
}
