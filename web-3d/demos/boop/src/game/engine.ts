import type { GameView, MoveJson, PieceKind, PlayerId } from './types';

export const BOARD_SIZE = 6;
export const KITTENS_PER_PLAYER = 8;
export const CATS_PER_PLAYER = 8;

export type Player = PlayerId;

export interface Coord {
  x: number;
  y: number;
}

export interface Piece {
  player: Player;
  kind: PieceKind;
}

export interface Pool {
  kittens_in_hand: number;
  cats_in_hand: number;
  cats_in_reserve: number;
}

export type Move =
  | { type: 'place'; coord: Coord; piece: PieceKind }
  | { type: 'graduate'; line: [Coord, Coord, Coord] }
  | { type: 'graduate_single_kitten'; coord: Coord }
  | { type: 'return_cat_to_pool'; coord: Coord };

export type TurnMode =
  | { kind: 'place' }
  | { kind: 'alternate_graduation' }
  | { kind: 'choose_graduation'; lines: [Coord, Coord, Coord][] };

export type LineHighlight =
  | { kind: 'graduation'; line: [Coord, Coord, Coord] }
  | { kind: 'win'; line: [Coord, Coord, Coord] }
  | { kind: 'eight_cats_on_bed' };

export interface PieceDisplacement {
  from: Coord;
  to: Coord;
  piece: Piece;
}

export interface OffBoardExit {
  from: Coord;
  piece: Piece;
  push: [number, number];
}

export interface MoveEffects {
  displacements: PieceDisplacement[];
  off_board: OffBoardExit[];
  line_highlight: LineHighlight | null;
  graduated_cells: [Coord, Coord, Coord] | null;
}

export class IllegalMove extends Error {
  constructor() {
    super('illegal move');
    this.name = 'IllegalMove';
  }
}

export interface PersistedState {
  board: ({ player: Player; kind: PieceKind } | null)[][];
  pools: [Pool, Pool];
  to_move: Player;
  winner: Player | null;
  pending_graduation: [number, number][][];
}

function poolIndex(player: Player): 0 | 1 {
  return player === 'A' ? 0 : 1;
}

export function opponent(player: Player): Player {
  return player === 'A' ? 'B' : 'A';
}

export function coordNew(x: number, y: number): Coord {
  const c = tryCoord(x, y);
  if (!c) throw new Error('coordinate out of board bounds');
  return c;
}

export function tryCoord(x: number, y: number): Coord | null {
  if (x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE) return { x, y };
  return null;
}

export function coordStep(coord: Coord, dx: number, dy: number): Coord | null {
  return tryCoord(coord.x + dx, coord.y + dy);
}

function coordEq(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

function lineEq(a: [Coord, Coord, Coord], b: [Coord, Coord, Coord]): boolean {
  return coordEq(a[0], b[0]) && coordEq(a[1], b[1]) && coordEq(a[2], b[2]);
}

export function moveCoord(m: Move): Coord {
  switch (m.type) {
    case 'place':
    case 'graduate_single_kitten':
    case 'return_cat_to_pool':
      return m.coord;
    case 'graduate':
      return m.line[1]!;
  }
}

export function moveEq(a: Move, b: Move): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'place':
      return (
        b.type === 'place' &&
        coordEq(a.coord, b.coord) &&
        a.piece === b.piece
      );
    case 'graduate':
      return b.type === 'graduate' && lineEq(a.line, b.line);
    case 'graduate_single_kitten':
      return b.type === 'graduate_single_kitten' && coordEq(a.coord, b.coord);
    case 'return_cat_to_pool':
      return b.type === 'return_cat_to_pool' && coordEq(a.coord, b.coord);
  }
}

export function poolNew(): Pool {
  return {
    kittens_in_hand: KITTENS_PER_PLAYER,
    cats_in_hand: 0,
    cats_in_reserve: CATS_PER_PLAYER,
  };
}

function normalizePlacementPreference(pool: Pool, preferred: PieceKind): PieceKind {
  if (preferred === 'kitten' && pool.kittens_in_hand === 0 && pool.cats_in_hand > 0) return 'cat';
  if (preferred === 'cat' && pool.cats_in_hand === 0 && pool.kittens_in_hand > 0) return 'kitten';
  return preferred;
}

function poolTake(pool: Pool, kind: PieceKind): boolean {
  if (kind === 'kitten' && pool.kittens_in_hand > 0) {
    pool.kittens_in_hand -= 1;
    return true;
  }
  if (kind === 'cat' && pool.cats_in_hand > 0) {
    pool.cats_in_hand -= 1;
    return true;
  }
  return false;
}

function poolReturn(pool: Pool, piece: Piece): void {
  if (piece.kind === 'kitten') pool.kittens_in_hand += 1;
  else pool.cats_in_hand += 1;
}

function poolGraduateKitten(pool: Pool): boolean {
  if (pool.cats_in_reserve === 0) return false;
  pool.cats_in_hand += 1;
  pool.cats_in_reserve -= 1;
  return true;
}

type BoardCell = Piece | null;

function boardEmpty(): BoardCell[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

function boardGet(board: BoardCell[][], coord: Coord): Piece | null {
  return board[coord.y]![coord.x] ?? null;
}

function boardSet(board: BoardCell[][], coord: Coord, piece: Piece): void {
  board[coord.y]![coord.x] = piece;
}

function boardClear(board: BoardCell[][], coord: Coord): void {
  board[coord.y]![coord.x] = null;
}

function boardIsEmpty(board: BoardCell[][], coord: Coord): boolean {
  return boardGet(board, coord) === null;
}

function boardEmptyCoords(board: BoardCell[][]): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const coord = { x, y };
      if (boardIsEmpty(board, coord)) out.push(coord);
    }
  }
  return out;
}

function boardCountPieces(board: BoardCell[][], player: Player): number {
  let n = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell?.player === player) n++;
    }
  }
  return n;
}

function boardCountCats(board: BoardCell[][], player: Player): number {
  let n = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell?.player === player && cell.kind === 'cat') n++;
    }
  }
  return n;
}

function cloneBoard(board: BoardCell[][]): BoardCell[][] {
  return board.map(row => row.slice());
}

const DIRECTIONS: readonly [number, number][] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

const LINE_DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

function triplesOf(board: BoardCell[][], player: Player): [Coord, Coord, Coord][] {
  const out: [Coord, Coord, Coord][] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const start = { x, y };
      for (const [dx, dy] of LINE_DIRS) {
        const a = coordStep(start, dx, dy);
        const b = coordStep(start, dx * 2, dy * 2);
        if (!a || !b) continue;
        const line: [Coord, Coord, Coord] = [start, a, b];
        if (line.every(c => boardGet(board, c)?.player === player)) out.push(line);
      }
    }
  }
  return out;
}

function graduationCandidates(board: BoardCell[][], player: Player): [Coord, Coord, Coord][] {
  return triplesOf(board, player).filter(line =>
    line.some(c => boardGet(board, c)?.kind === 'kitten'),
  );
}

function findWinningCatLine(board: BoardCell[][], player: Player): [Coord, Coord, Coord] | null {
  for (const line of triplesOf(board, player)) {
    if (line.every(c => boardGet(board, c)?.kind === 'cat')) return line;
  }
  return null;
}

type PendingBoop =
  | { kind: 'displace'; from: Coord; to: Coord; piece: Piece }
  | { kind: 'off_board'; from: Coord; piece: Piece; push: [number, number] };

function resolveBoops(
  board: BoardCell[][],
  placedAt: Coord,
  placed: Piece,
  pools: [Pool, Pool],
  effects: MoveEffects,
): void {
  const snapshot = cloneBoard(board);
  const pending: PendingBoop[] = [];
  const reservedDestinations = new Set<string>();

  for (const [dx, dy] of DIRECTIONS) {
    const adj = coordStep(placedAt, dx, dy);
    if (!adj) continue;
    const piece = boardGet(snapshot, adj);
    if (!piece) continue;
    if (placed.kind === 'kitten' && piece.kind === 'cat') continue;

    const pushDir: [number, number] = [dx, dy];
    const dest = coordStep(adj, dx, dy);
    if (!dest) {
      pending.push({ kind: 'off_board', from: adj, piece, push: pushDir });
    } else if (!boardIsEmpty(snapshot, dest) || reservedDestinations.has(`${dest.x},${dest.y}`)) {
      continue;
    } else {
      reservedDestinations.add(`${dest.x},${dest.y}`);
      pending.push({ kind: 'displace', from: adj, to: dest, piece });
    }
  }

  for (const boop of pending) {
    if (boop.kind === 'off_board') {
      boardClear(board, boop.from);
      poolReturn(pools[poolIndex(boop.piece.player)]!, boop.piece);
      effects.off_board.push({ from: boop.from, piece: boop.piece, push: boop.push });
    } else {
      boardClear(board, boop.from);
      boardSet(board, boop.to, boop.piece);
      effects.displacements.push({ from: boop.from, to: boop.to, piece: boop.piece });
    }
  }
}

function graduateLine(state: GameState, player: Player, line: [Coord, Coord, Coord]): void {
  state.lastEffects.line_highlight = { kind: 'graduation', line };
  state.lastEffects.graduated_cells = line;
  const pool = state.pools[poolIndex(player)]!;
  for (const coord of line) {
    const piece = boardGet(state.board, coord);
    if (!piece) continue;
    boardClear(state.board, coord);
    if (piece.kind === 'kitten') poolGraduateKitten(pool);
    else pool.cats_in_hand += 1;
  }
}

function applyAnyWinningCatLine(state: GameState, order: [Player, Player]): boolean {
  for (const player of order) {
    const line = findWinningCatLine(state.board, player);
    if (line) {
      state.lastEffects.line_highlight = { kind: 'win', line };
      state.winner = player;
      return true;
    }
  }
  return false;
}

function finishTurn(state: GameState, player: Player): void {
  if (state.winner === null) {
    if (applyAnyWinningCatLine(state, [player, opponent(player)])) {
      /* winner set */
    } else if (boardCountCats(state.board, player) >= CATS_PER_PLAYER) {
      state.lastEffects.line_highlight = { kind: 'eight_cats_on_bed' };
      state.winner = player;
    }
  }
  if (state.winner === null) state.toMove = opponent(player);
}

function applyLineOutcomes(state: GameState, mover: Player): boolean {
  if (applyAnyWinningCatLine(state, [mover, opponent(mover)])) return true;

  for (const player of [mover, opponent(mover)] as const) {
    const candidates = graduationCandidates(state.board, player);
    if (candidates.length === 0) continue;
    if (candidates.length === 1) {
      graduateLine(state, player, candidates[0]!);
    } else {
      state.pendingGraduation = candidates;
      state.toMove = player;
      return true;
    }
  }
  return false;
}

function alternateGraduationMoves(state: GameState, player: Player, pool: Pool): Move[] {
  const moves: Move[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const coord = { x, y };
      const piece = boardGet(state.board, coord);
      if (!piece || piece.player !== player) continue;
      if (piece.kind === 'kitten' && pool.cats_in_reserve > 0) {
        moves.push({ type: 'graduate_single_kitten', coord });
      } else if (piece.kind === 'cat') {
        moves.push({ type: 'return_cat_to_pool', coord });
      }
    }
  }
  return moves;
}

export class GameState {
  board: BoardCell[][];
  pools: [Pool, Pool];
  toMove: Player;
  winner: Player | null;
  lastEffects: MoveEffects;
  pendingGraduation: [Coord, Coord, Coord][];

  constructor() {
    this.board = boardEmpty();
    this.pools = [poolNew(), poolNew()];
    this.toMove = 'A';
    this.winner = null;
    this.lastEffects = emptyEffects();
    this.pendingGraduation = [];
  }

  clone(): GameState {
    const s = new GameState();
    s.board = cloneBoard(this.board);
    s.pools = [
      { ...this.pools[0]! },
      { ...this.pools[1]! },
    ];
    s.toMove = this.toMove;
    s.winner = this.winner;
    s.lastEffects = {
      displacements: this.lastEffects.displacements.map(d => ({
        ...d,
        from: { ...d.from },
        to: { ...d.to },
        piece: { ...d.piece },
      })),
      off_board: this.lastEffects.off_board.map(o => ({
        ...o,
        from: { ...o.from },
        piece: { ...o.piece },
      })),
      line_highlight: this.lastEffects.line_highlight
        ? this.lastEffects.line_highlight.kind === 'eight_cats_on_bed'
          ? { kind: 'eight_cats_on_bed' }
          : {
              kind: this.lastEffects.line_highlight.kind,
              line: this.lastEffects.line_highlight.line.map(c => ({ ...c })) as [Coord, Coord, Coord],
            }
        : null,
      graduated_cells: this.lastEffects.graduated_cells
        ? (this.lastEffects.graduated_cells.map(c => ({ ...c })) as [Coord, Coord, Coord])
        : null,
    };
    s.pendingGraduation = this.pendingGraduation.map(l => l.map(c => ({ ...c })) as [Coord, Coord, Coord]);
    return s;
  }

  boardGet(coord: Coord): Piece | null {
    return boardGet(this.board, coord);
  }

  setPiece(coord: Coord, piece: Piece): void {
    boardSet(this.board, coord, piece);
  }

  setToMove(player: Player): void {
    this.toMove = player;
  }

  setPool(player: Player, pool: Pool): void {
    this.pools[poolIndex(player)] = { ...pool };
  }

  setWinner(winner: Player | null): void {
    this.winner = winner;
  }

  setPendingGraduation(lines: [Coord, Coord, Coord][]): void {
    this.pendingGraduation = lines.map(l => l.map(c => ({ ...c })) as [Coord, Coord, Coord]);
  }

  pool(player: Player): Pool {
    return { ...this.pools[poolIndex(player)]! };
  }

  turnMode(): TurnMode {
    if (this.pendingGraduation.length > 0) {
      return { kind: 'choose_graduation', lines: this.pendingGraduation };
    }
    if (boardCountPieces(this.board, this.toMove) >= 8) {
      return { kind: 'alternate_graduation' };
    }
    return { kind: 'place' };
  }

  pendingGraduationLines(): [Coord, Coord, Coord][] {
    return this.pendingGraduation;
  }

  requiresAlternateGraduation(): boolean {
    return this.winner === null && this.turnMode().kind === 'alternate_graduation';
  }

  graduationChoiceAt(coord: Coord): [Coord, Coord, Coord] | null {
    const containing = this.pendingGraduation.filter(line => line.some(c => coordEq(c, coord)));
    if (containing.length !== 1) return null;
    return containing[0]!;
  }

  legalMoves(): Move[] {
    if (this.winner !== null) return [];
    if (this.pendingGraduation.length > 0) {
      return this.pendingGraduation.map(line => ({ type: 'graduate', line }));
    }
    const player = this.toMove;
    const pool = this.pool(player);
    const onBoard = boardCountPieces(this.board, player);
    if (onBoard >= 8) return alternateGraduationMoves(this, player, pool);

    const moves: Move[] = [];
    for (const coord of boardEmptyCoords(this.board)) {
      if (pool.kittens_in_hand > 0) moves.push({ type: 'place', coord, piece: 'kitten' });
      if (pool.cats_in_hand > 0) moves.push({ type: 'place', coord, piece: 'cat' });
    }
    return moves;
  }

  moveForInteraction(player: Player, coord: Coord, preferredPlacement: PieceKind): Move | null {
    if (this.toMove !== player || this.winner !== null) return null;
    const legal = this.legalMoves();
    if (legal.length === 0) return null;

    if (this.pendingGraduation.length > 0) {
      const line = this.graduationChoiceAt(coord);
      if (!line) return null;
      const graduate: Move = { type: 'graduate', line };
      return legal.some(m => moveEq(m, graduate)) ? graduate : null;
    }

    if (this.requiresAlternateGraduation()) {
      const piece = boardGet(this.board, coord);
      if (!piece || piece.player !== player) return null;
      const graduate: Move = { type: 'graduate_single_kitten', coord };
      const returnCat: Move = { type: 'return_cat_to_pool', coord };
      if (piece.kind === 'kitten' && legal.some(m => moveEq(m, graduate))) return graduate;
      if (piece.kind === 'cat' && legal.some(m => moveEq(m, returnCat))) return returnCat;
      return null;
    }

    if (!boardIsEmpty(this.board, coord)) return null;

    const preferred = normalizePlacementPreference(this.pool(player), preferredPlacement);
    const preferredMove: Move = { type: 'place', coord, piece: preferred };
    if (legal.some(m => moveEq(m, preferredMove))) return preferredMove;
    const fallback: Move = {
      type: 'place',
      coord,
      piece: preferred === 'kitten' ? 'cat' : 'kitten',
    };
    return legal.some(m => moveEq(m, fallback)) ? fallback : null;
  }

  apply(playerMove: Move): void {
    if (this.winner !== null) throw new IllegalMove();
    if (!this.legalMoves().some(m => moveEq(m, playerMove))) throw new IllegalMove();

    this.lastEffects = emptyEffects();

    switch (playerMove.type) {
      case 'place':
        this.applyPlace(playerMove.coord, playerMove.piece);
        break;
      case 'graduate':
        this.applyGraduate(playerMove.line);
        break;
      case 'graduate_single_kitten':
        this.applyGraduateSingleKitten(playerMove.coord);
        break;
      case 'return_cat_to_pool':
        this.applyReturnCatToPool(playerMove.coord);
        break;
    }
  }

  private applyPlace(coord: Coord, kind: PieceKind): void {
    if (!tryCoord(coord.x, coord.y) || !boardIsEmpty(this.board, coord)) throw new IllegalMove();
    const player = this.toMove;
    const pool = this.pools[poolIndex(player)]!;
    if (!poolTake(pool, kind)) throw new IllegalMove();
    if (boardCountPieces(this.board, player) >= 8) {
      poolReturn(pool, { player, kind });
      throw new IllegalMove();
    }

    const placed: Piece = { player, kind };
    boardSet(this.board, coord, placed);
    resolveBoops(this.board, coord, placed, this.pools, this.lastEffects);

    if (applyLineOutcomes(this, player)) return;
    finishTurn(this, player);
  }

  private applyGraduate(line: [Coord, Coord, Coord]): void {
    if (!this.pendingGraduation.some(l => lineEq(l, line))) throw new IllegalMove();
    const player = this.toMove;
    this.pendingGraduation = [];
    graduateLine(this, player, line);
    finishTurn(this, player);
  }

  private applyGraduateSingleKitten(coord: Coord): void {
    const player = this.toMove;
    if (boardCountPieces(this.board, player) < 8) throw new IllegalMove();
    const piece = boardGet(this.board, coord);
    if (!piece || piece.player !== player || piece.kind !== 'kitten') throw new IllegalMove();
    if (!poolGraduateKitten(this.pools[poolIndex(player)]!)) throw new IllegalMove();
    boardClear(this.board, coord);
    finishTurn(this, player);
  }

  private applyReturnCatToPool(coord: Coord): void {
    const player = this.toMove;
    if (boardCountPieces(this.board, player) < 8) throw new IllegalMove();
    const piece = boardGet(this.board, coord);
    if (!piece || piece.player !== player || piece.kind !== 'cat') throw new IllegalMove();
    boardClear(this.board, coord);
    this.pools[poolIndex(player)]!.cats_in_hand += 1;
    finishTurn(this, player);
  }
}

function emptyEffects(): MoveEffects {
  return {
    displacements: [],
    off_board: [],
    line_highlight: null,
    graduated_cells: null,
  };
}

function coordPair(c: Coord): { x: number; y: number } {
  return { x: c.x, y: c.y };
}

function lineToArray(line: [Coord, Coord, Coord]): [number, number][] {
  return line.map(c => [c.x, c.y] as [number, number]);
}

function arrayToCoord(pair: [number, number]): Coord | null {
  return tryCoord(pair[0], pair[1]);
}

function arrayToLine(line: [number, number][]): [Coord, Coord, Coord] | null {
  if (line.length !== 3) return null;
  const a = arrayToCoord(line[0]!);
  const b = arrayToCoord(line[1]!);
  const c = arrayToCoord(line[2]!);
  if (!a || !b || !c) return null;
  return [a, b, c];
}

function moveToDto(m: Move): MoveJson {
  switch (m.type) {
    case 'place':
      return { type: 'place', x: m.coord.x, y: m.coord.y, piece: m.piece };
    case 'graduate':
      return { type: 'graduate', line: lineToArray(m.line) };
    case 'graduate_single_kitten':
      return { type: 'graduate_single_kitten', x: m.coord.x, y: m.coord.y };
    case 'return_cat_to_pool':
      return { type: 'return_cat_to_pool', x: m.coord.x, y: m.coord.y };
  }
}

function dtoToMove(d: MoveJson): Move | null {
  switch (d.type) {
    case 'place': {
      const coord = tryCoord(d.x, d.y);
      if (!coord) return null;
      return { type: 'place', coord, piece: d.piece };
    }
    case 'graduate': {
      const line = arrayToLine(d.line);
      if (!line) return null;
      return { type: 'graduate', line };
    }
    case 'graduate_single_kitten': {
      const coord = tryCoord(d.x, d.y);
      if (!coord) return null;
      return { type: 'graduate_single_kitten', coord };
    }
    case 'return_cat_to_pool': {
      const coord = tryCoord(d.x, d.y);
      if (!coord) return null;
      return { type: 'return_cat_to_pool', coord };
    }
  }
}

function buildView(state: GameState): GameView {
  const board: GameView['board'] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: GameView['board'][number] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      const p = boardGet(state.board, { x, y });
      row.push(p ? { player: p.player, kind: p.kind } : null);
    }
    board.push(row);
  }
  const tm = state.turnMode();
  let turn_mode: GameView['turn_mode'];
  if (tm.kind === 'choose_graduation') {
    turn_mode = { kind: 'choose_graduation', lines: tm.lines.map(lineToArray) };
  } else if (tm.kind === 'alternate_graduation') {
    turn_mode = { kind: 'alternate_graduation' };
  } else {
    turn_mode = { kind: 'place' };
  }

  const effects = state.lastEffects;
  let line_highlight: GameView['effects']['line_highlight'] = null;
  if (effects.line_highlight) {
    const h = effects.line_highlight;
    if (h.kind === 'eight_cats_on_bed') line_highlight = { kind: 'eight_cats_on_bed' };
    else if (h.kind === 'graduation') line_highlight = { kind: 'graduation', line: lineToArray(h.line) };
    else line_highlight = { kind: 'win', line: lineToArray(h.line) };
  }

  return {
    to_move: state.toMove,
    winner: state.winner,
    turn_mode,
    board,
    pools: [state.pool('A'), state.pool('B')],
    effects: {
      displacements: effects.displacements.map(d => ({
        from: coordPair(d.from),
        to: coordPair(d.to),
        player: d.piece.player,
        kind: d.piece.kind,
      })),
      off_board: effects.off_board.map(o => ({
        from: coordPair(o.from),
        player: o.piece.player,
        kind: o.piece.kind,
        push_x: o.push[0],
        push_y: o.push[1],
      })),
      line_highlight,
      graduated_cells: effects.graduated_cells ? lineToArray(effects.graduated_cells) : null,
    },
  };
}

function persist(state: GameState): PersistedState {
  const viewBoard: PersistedState['board'] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: PersistedState['board'][number] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      const p = boardGet(state.board, { x, y });
      row.push(p ? { player: p.player, kind: p.kind } : null);
    }
    viewBoard.push(row);
  }
  return {
    board: viewBoard,
    pools: [state.pool('A'), state.pool('B')],
    to_move: state.toMove,
    winner: state.winner,
    pending_graduation: state.pendingGraduation.map(lineToArray),
  };
}

export function restoreGameState(data: PersistedState): GameState {
  const state = new GameState();
  for (let y = 0; y < data.board.length; y++) {
    for (let x = 0; x < (data.board[y]?.length ?? 0); x++) {
      const cell = data.board[y]?.[x];
      if (cell) state.setPiece({ x, y }, cell);
    }
  }
  state.setPool('A', data.pools[0]!);
  state.setPool('B', data.pools[1]!);
  state.setToMove(data.to_move);
  state.setWinner(data.winner);
  const pending: [Coord, Coord, Coord][] = [];
  for (const l of data.pending_graduation) {
    const line = arrayToLine(l);
    if (!line) throw new Error('bad line');
    pending.push(line);
  }
  state.setPendingGraduation(pending);
  return state;
}

/** WASM-compatible facade used by the demo and worker. */
export class BoopGame {
  private state: GameState;

  constructor() {
    this.state = new GameState();
  }

  view_json(): string {
    return JSON.stringify(buildView(this.state));
  }

  export_state(): string {
    return JSON.stringify(persist(this.state));
  }

  static import_state(json: string): BoopGame {
    const data = JSON.parse(json) as PersistedState;
    const game = new BoopGame();
    game.state = restoreGameState(data);
    return game;
  }

  apply_move_json(json: string): string {
    const dto = JSON.parse(json) as MoveJson;
    const mv = dtoToMove(dto);
    if (!mv) throw new Error('invalid move');
    this.state.apply(mv);
    return this.view_json();
  }

  move_for_interaction_json(player: string, x: number, y: number, preferred: string): string | undefined {
    if (player !== 'A' && player !== 'B') return undefined;
    const coord = tryCoord(x, y);
    if (!coord) return undefined;
    if (preferred !== 'kitten' && preferred !== 'cat') return undefined;
    const mv = this.state.moveForInteraction(player, coord, preferred);
    return mv ? JSON.stringify(moveToDto(mv)) : undefined;
  }

  legal_moves_json(): string {
    return JSON.stringify(this.state.legalMoves().map(moveToDto));
  }

  /** Internal rules state (for AI). */
  innerState(): GameState {
    return this.state;
  }

  choose_ai_move(maxDepth: number, maxNodes: number, timeBudgetMs: number): string | undefined {
    return chooseAiMoveHook(this, maxDepth, maxNodes, timeBudgetMs);
  }
}

let chooseAiMoveHook: (
  game: BoopGame,
  maxDepth: number,
  maxNodes: number,
  timeBudgetMs: number,
) => string | undefined = () => undefined;

export function bindChooseAiMove(
  fn: (state: GameState, maxDepth: number, maxNodes: number, timeBudgetMs: number) => Move | null,
): void {
  chooseAiMoveHook = (game, maxDepth, maxNodes, timeBudgetMs) => {
    if (game.innerState().toMove !== 'B') return undefined;
    const mv = fn(game.innerState(), maxDepth, maxNodes, timeBudgetMs);
    return mv ? JSON.stringify(moveToDto(mv)) : undefined;
  };
}

export { moveToDto, dtoToMove, buildView, persist, restoreGameState as restoreFull };
