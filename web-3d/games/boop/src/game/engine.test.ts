import { describe, expect, it } from 'vitest';
import './ai';
import {
  BoopGame,
  GameState,
  coordNew,
  moveEq,
  type Piece,
  type Player,
  type Pool,
  BOARD_SIZE,
} from './engine';
import { parseGameView } from './types';

function kitten(player: Player): Piece {
  return { player, kind: 'kitten' };
}

function cat(player: Player): Piece {
  return { player, kind: 'cat' };
}

function pool(kittens: number, cats: number, reserve: number): Pool {
  return { kittens_in_hand: kittens, cats_in_hand: cats, cats_in_reserve: reserve };
}

function place(g: GameState, x: number, y: number, piece: 'kitten' | 'cat' = 'kitten'): void {
  g.apply({ type: 'place', coord: coordNew(x, y), piece });
}

function countPiecesOnBoard(g: GameState): number {
  let n = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (g.boardGet({ x, y })) n++;
    }
  }
  return n;
}

const ROW: [ReturnType<typeof coordNew>, ReturnType<typeof coordNew>, ReturnType<typeof coordNew>] = [
  coordNew(0, 0),
  coordNew(1, 0),
  coordNew(2, 0),
];
const COLUMN: [ReturnType<typeof coordNew>, ReturnType<typeof coordNew>, ReturnType<typeof coordNew>] = [
  coordNew(2, 0),
  coordNew(2, 1),
  coordNew(2, 2),
];

function twoLineSetup(): GameState {
  const g = new GameState();
  g.setPiece(coordNew(0, 0), kitten('A'));
  g.setPiece(coordNew(1, 0), kitten('A'));
  g.setPiece(coordNew(2, 1), kitten('A'));
  g.setPiece(coordNew(2, 2), kitten('A'));
  g.setToMove('A');
  g.setPool('A', pool(4, 0, 8));
  return g;
}

describe('Boop rules (engine)', () => {
  it('place_kitten', () => {
    const g = new GameState();
    const coord = coordNew(2, 2);
    g.apply({ type: 'place', coord, piece: 'kitten' });
    expect(g.boardGet(coord)).toEqual(kitten('A'));
    expect(g.pool('A').kittens_in_hand).toBe(7);
    expect(g.toMove).toBe('B');
  });

  it('boop_off_edge_records_push_direction', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), kitten('A'));
    g.setToMove('B');
    g.setPool('B', pool(7, 0, 8));
    g.setPool('A', pool(7, 0, 8));
    place(g, 1, 0);
    expect(g.lastEffects.off_board).toHaveLength(1);
    expect(g.lastEffects.off_board[0]!.from).toEqual(coordNew(0, 0));
    expect(g.lastEffects.off_board[0]!.push).toEqual([-1, 0]);
  });

  it('boop_off_edge', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), kitten('A'));
    g.setToMove('B');
    g.setPool('B', pool(7, 0, 8));
    g.setPool('A', pool(7, 0, 8));
    place(g, 1, 0);
    expect(g.boardGet(coordNew(0, 0))).toBeNull();
    expect(g.pool('A').kittens_in_hand).toBe(8);
  });

  it('graduation_emits_line_highlight', () => {
    const g = new GameState();
    for (const x of [0, 1]) g.setPiece(coordNew(x, 0), kitten('A'));
    g.setToMove('A');
    g.setPool('A', pool(6, 0, 8));
    place(g, 2, 0);
    expect(g.lastEffects.line_highlight?.kind).toBe('graduation');
  });

  it('three_kitten_graduation_records_all_three_cells_and_clears_bed', () => {
    const g = new GameState();
    for (const x of [0, 1]) g.setPiece(coordNew(x, 0), kitten('A'));
    g.setToMove('A');
    g.setPool('A', pool(6, 0, 8));
    place(g, 2, 0);
    expect(g.lastEffects.graduated_cells).toEqual([coordNew(0, 0), coordNew(1, 0), coordNew(2, 0)]);
    for (const x of [0, 1, 2]) expect(g.boardGet(coordNew(x, 0))).toBeNull();
  });

  it('graduate_three_kittens', () => {
    const g = new GameState();
    for (const x of [0, 1]) g.setPiece(coordNew(x, 0), kitten('A'));
    g.setToMove('A');
    g.setPool('A', pool(6, 0, 8));
    place(g, 2, 0);
    for (const x of [0, 1, 2]) expect(g.boardGet(coordNew(x, 0))).toBeNull();
    expect(g.pool('A').cats_in_hand).toBe(3);
    expect(g.pool('A').kittens_in_hand).toBe(5);
    expect(g.pool('A').cats_in_reserve).toBe(5);
  });

  it('graduate_mixed_line_promotes_per_kitten_and_returns_cats', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), kitten('A'));
    g.setPiece(coordNew(1, 0), cat('A'));
    g.setToMove('A');
    g.setPool('A', pool(6, 0, 8));
    place(g, 2, 0);
    for (const x of [0, 1, 2]) expect(g.boardGet(coordNew(x, 0))).toBeNull();
    expect(g.pool('A').cats_in_hand).toBe(3);
    expect(g.pool('A').cats_in_reserve).toBe(6);
    expect(g.pool('A').kittens_in_hand).toBe(5);
  });

  it('three_cats_in_a_row_is_win_not_graduation', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), cat('A'));
    g.setPiece(coordNew(1, 0), cat('A'));
    g.setToMove('A');
    g.setPool('A', pool(8, 1, 5));
    g.apply({ type: 'place', coord: coordNew(2, 0), piece: 'cat' });
    expect(g.winner).toBe('A');
    expect(g.boardGet(coordNew(0, 0))).toBeTruthy();
    expect(g.boardGet(coordNew(1, 0))).toBeTruthy();
    expect(g.boardGet(coordNew(2, 0))).toBeTruthy();
  });

  it('three_cats_diagonal_down_right_wins', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), cat('A'));
    g.setPiece(coordNew(1, 1), cat('A'));
    g.setToMove('A');
    g.setPool('A', pool(8, 1, 5));
    g.apply({ type: 'place', coord: coordNew(2, 2), piece: 'cat' });
    expect(g.winner).toBe('A');
  });

  it('three_cats_diagonal_down_left_wins', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 2), cat('A'));
    g.setPiece(coordNew(1, 1), cat('A'));
    g.setToMove('A');
    g.setPool('A', pool(8, 1, 5));
    g.apply({ type: 'place', coord: coordNew(2, 0), piece: 'cat' });
    expect(g.winner).toBe('A');
  });

  it('second_player_three_kittens_diagonal_graduates_via_boop', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), kitten('A'));
    g.setPiece(coordNew(1, 1), kitten('A'));
    g.setPiece(coordNew(3, 3), kitten('A'));
    g.setToMove('B');
    g.setPool('B', pool(7, 0, 8));
    g.setPool('A', pool(5, 0, 6));
    place(g, 4, 4);
    expect(g.winner).toBeNull();
    expect(g.lastEffects.line_highlight?.kind).toBe('graduation');
    expect(g.boardGet(coordNew(2, 2))).toBeNull();
  });

  it('win_with_three_cats_in_a_row', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), cat('A'));
    g.setPiece(coordNew(1, 0), cat('A'));
    g.setToMove('A');
    g.setPool('A', pool(8, 1, 5));
    g.apply({ type: 'place', coord: coordNew(2, 0), piece: 'cat' });
    expect(g.winner).toBe('A');
  });

  it('brace_blocks_push_along_line', () => {
    const g = new GameState();
    g.setPiece(coordNew(1, 0), kitten('B'));
    g.setPiece(coordNew(2, 0), kitten('B'));
    g.setToMove('A');
    g.setPool('A', pool(8, 0, 8));
    place(g, 0, 0);
    expect(g.boardGet(coordNew(1, 0))).toEqual(kitten('B'));
    expect(g.boardGet(coordNew(2, 0))).toEqual(kitten('B'));
  });

  it('brace_does_not_block_perpendicular_boop', () => {
    const g = new GameState();
    g.setPiece(coordNew(1, 0), kitten('B'));
    g.setPiece(coordNew(2, 0), kitten('B'));
    g.setToMove('A');
    g.setPool('A', pool(8, 0, 8));
    place(g, 1, 1);
    expect(g.boardGet(coordNew(1, 0))).toBeNull();
  });

  it('alternate_graduation_when_bed_full', () => {
    const g = new GameState();
    for (let i = 0; i < 8; i++) {
      g.setPiece(coordNew(i % 6, Math.floor(i / 6)), i < 4 ? kitten('A') : cat('A'));
    }
    g.setToMove('A');
    g.setPool('A', pool(0, 0, 4));
    const moves = g.legalMoves();
    expect(moves.some(m => m.type === 'graduate_single_kitten' && m.coord.x === 0 && m.coord.y === 0)).toBe(true);
    expect(moves.some(m => m.type === 'return_cat_to_pool' && m.coord.x === 4 && m.coord.y === 0)).toBe(true);
    expect(moves.every(m => m.type !== 'place')).toBe(true);
  });

  it('apply_alternate_graduate_kitten', () => {
    const g = new GameState();
    const layout: [number, number, 'kitten' | 'cat'][] = [
      [0, 0, 'kitten'],
      [0, 2, 'kitten'],
      [0, 4, 'kitten'],
      [2, 0, 'kitten'],
      [2, 2, 'kitten'],
      [4, 0, 'cat'],
      [4, 2, 'cat'],
      [5, 5, 'cat'],
    ];
    for (const [x, y, kind] of layout) g.setPiece(coordNew(x, y), { player: 'A', kind });
    g.setToMove('A');
    g.setPool('A', pool(0, 0, 2));
    g.apply({ type: 'graduate_single_kitten', coord: coordNew(0, 0) });
    expect(g.boardGet(coordNew(0, 0))).toBeNull();
    expect(g.pool('A').cats_in_hand).toBe(1);
    expect(g.pool('A').cats_in_reserve).toBe(1);
    expect(g.toMove).toBe('B');
  });

  it('apply_return_cat_to_pool_when_bed_full', () => {
    const g = new GameState();
    const layout: [number, number, 'kitten' | 'cat'][] = [
      [0, 0, 'kitten'],
      [0, 2, 'kitten'],
      [0, 4, 'kitten'],
      [2, 0, 'kitten'],
      [2, 2, 'kitten'],
      [4, 0, 'cat'],
      [4, 2, 'cat'],
      [5, 5, 'cat'],
    ];
    for (const [x, y, kind] of layout) g.setPiece(coordNew(x, y), { player: 'A', kind });
    g.setToMove('A');
    g.setPool('A', pool(0, 1, 0));
    g.apply({ type: 'return_cat_to_pool', coord: coordNew(5, 5) });
    expect(g.boardGet(coordNew(5, 5))).toBeNull();
    expect(g.pool('A').cats_in_hand).toBe(2);
    expect(g.toMove).toBe('B');
  });
});

describe('Boop resolution', () => {
  it('no_chain_boop_when_push_lands_beside_another_piece', () => {
    const g = new GameState();
    const pushed = kitten('B');
    const bystander = kitten('B');
    g.setPiece(coordNew(1, 0), pushed);
    g.setPiece(coordNew(3, 0), bystander);
    g.setToMove('A');
    g.setPool('A', pool(8, 0, 8));
    place(g, 0, 0);
    expect(g.boardGet(coordNew(2, 0))).toEqual(pushed);
    expect(g.boardGet(coordNew(3, 0))).toEqual(bystander);
    expect(g.lastEffects.displacements).toHaveLength(1);
    expect(g.lastEffects.displacements[0]!.from).toEqual(coordNew(1, 0));
    expect(g.lastEffects.displacements[0]!.to).toEqual(coordNew(2, 0));
  });

  it('multiple_same_kind_boop_displacements_are_distinct', () => {
    const g = new GameState();
    g.setPiece(coordNew(1, 0), kitten('B'));
    g.setPiece(coordNew(0, 1), kitten('B'));
    g.setToMove('A');
    g.setPool('A', pool(8, 0, 8));
    place(g, 0, 0);
    expect(g.lastEffects.displacements).toHaveLength(2);
    expect(
      g.lastEffects.displacements.some(d => d.from.x === 1 && d.from.y === 0 && d.to.x === 2 && d.to.y === 0),
    ).toBe(true);
    expect(
      g.lastEffects.displacements.some(d => d.from.x === 0 && d.from.y === 1 && d.to.x === 0 && d.to.y === 2),
    ).toBe(true);
  });

  it('does_not_push_into_snapshot_occupied_cell', () => {
    const g = new GameState();
    g.setPiece(coordNew(1, 0), kitten('B'));
    g.setPiece(coordNew(3, 0), kitten('B'));
    g.setToMove('A');
    g.setPool('A', pool(8, 0, 8));
    place(g, 0, 0);
    expect(g.boardGet(coordNew(1, 0))).toBeNull();
    expect(g.boardGet(coordNew(2, 0))).toEqual(kitten('B'));
    expect(g.boardGet(coordNew(3, 0))).toEqual(kitten('B'));
    expect(g.lastEffects.displacements).toHaveLength(1);
  });

  it('simultaneous_boops_reserve_destination_cells', () => {
    const g = new GameState();
    g.setPiece(coordNew(1, 0), kitten('B'));
    g.setPiece(coordNew(0, 2), kitten('B'));
    g.setToMove('A');
    g.setPool('A', pool(8, 0, 8));
    place(g, 0, 1);
    for (const d of g.lastEffects.displacements) {
      expect(d.from).not.toEqual(d.to);
      expect(g.boardGet(d.to)).toBeTruthy();
    }
  });

  it('board_never_has_two_pieces_in_one_cell_after_place', () => {
    const g = new GameState();
    g.setPiece(coordNew(2, 2), cat('B'));
    g.setPiece(coordNew(2, 3), kitten('B'));
    g.setToMove('A');
    g.setPool('A', pool(8, 0, 8));
    place(g, 2, 1);
    expect(countPiecesOnBoard(g)).toBe(3);
  });
});

describe('Boop shell parity', () => {
  it('placing_between_two_pieces_boops_both_apart', () => {
    const g = new GameState();
    g.setPiece(coordNew(2, 2), kitten('B'));
    g.setPiece(coordNew(4, 2), kitten('B'));
    g.setToMove('A');
    place(g, 3, 2);
    expect(g.boardGet(coordNew(2, 2))).toBeNull();
    expect(g.boardGet(coordNew(4, 2))).toBeNull();
    expect(g.boardGet(coordNew(1, 2))).toEqual(kitten('B'));
    expect(g.boardGet(coordNew(5, 2))).toEqual(kitten('B'));
    expect(g.lastEffects.displacements).toHaveLength(2);
  });

  it('placing_between_two_pieces_on_diagonal_boops_one_off_and_one_along', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), kitten('B'));
    g.setPiece(coordNew(2, 2), kitten('A'));
    g.setToMove('A');
    g.setPool('A', pool(7, 0, 8));
    g.setPool('B', pool(7, 0, 8));
    place(g, 1, 1);
    expect(g.boardGet(coordNew(0, 0))).toBeNull();
    expect(g.pool('B').kittens_in_hand).toBe(8);
    expect(g.boardGet(coordNew(3, 3))).toEqual(kitten('A'));
    expect(g.lastEffects.off_board).toHaveLength(1);
    expect(g.lastEffects.displacements).toHaveLength(1);
  });

  it('gap_behind_piece_means_it_is_booped_even_if_line_continues_further', () => {
    const g = new GameState();
    g.setPiece(coordNew(1, 0), kitten('B'));
    g.setPiece(coordNew(3, 0), kitten('B'));
    g.setPiece(coordNew(4, 0), kitten('A'));
    g.setToMove('A');
    place(g, 0, 0);
    expect(g.boardGet(coordNew(1, 0))).toBeNull();
    expect(g.boardGet(coordNew(2, 0))).toEqual(kitten('B'));
    expect(g.boardGet(coordNew(3, 0))).toEqual(kitten('B'));
    expect(g.boardGet(coordNew(4, 0))).toEqual(kitten('A'));
  });

  it('kitten_does_not_boop_cat_but_cat_boops_cat', () => {
    const g = new GameState();
    g.setPiece(coordNew(3, 3), cat('B'));
    g.setToMove('A');
    g.setPool('A', pool(6, 1, 7));
    place(g, 2, 3);
    expect(g.boardGet(coordNew(3, 3))).toEqual(cat('B'));
    g.setToMove('A');
    g.apply({ type: 'place', coord: coordNew(3, 2), piece: 'cat' });
    expect(g.boardGet(coordNew(3, 3))).toBeNull();
    expect(g.boardGet(coordNew(3, 4))).toEqual(cat('B'));
  });

  it('second_player_diagonal_cat_line_on_own_placement_wins', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 2), cat('B'));
    g.setPiece(coordNew(1, 1), cat('B'));
    g.setToMove('B');
    g.setPool('B', pool(7, 1, 6));
    g.apply({ type: 'place', coord: coordNew(2, 0), piece: 'cat' });
    expect(g.winner).toBe('B');
  });

  it('opponent_diagonal_cat_line_via_boop_wins', () => {
    const g = new GameState();
    g.setPiece(coordNew(2, 0), cat('A'));
    g.setPiece(coordNew(3, 1), cat('A'));
    g.setPiece(coordNew(4, 3), cat('A'));
    g.setToMove('B');
    g.setPool('B', pool(7, 1, 7));
    g.apply({ type: 'place', coord: coordNew(4, 4), piece: 'cat' });
    expect(g.winner).toBe('A');
    expect(g.lastEffects.line_highlight).toEqual({
      kind: 'win',
      line: [coordNew(2, 0), coordNew(3, 1), coordNew(4, 2)],
    });
  });

  it('three_cat_line_wins_even_when_it_shares_a_cat_with_a_mixed_line', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), cat('A'));
    g.setPiece(coordNew(1, 0), cat('A'));
    g.setPiece(coordNew(2, 1), kitten('A'));
    g.setPiece(coordNew(2, 2), kitten('A'));
    g.setToMove('A');
    g.setPool('A', pool(2, 2, 4));
    g.apply({ type: 'place', coord: coordNew(2, 0), piece: 'cat' });
    expect(g.winner).toBe('A');
    expect(g.lastEffects.line_highlight).toEqual({
      kind: 'win',
      line: [coordNew(0, 0), coordNew(1, 0), coordNew(2, 0)],
    });
    expect(g.lastEffects.graduated_cells).toBeNull();
  });

  it('eight_cats_on_bed_wins_at_end_of_turn', () => {
    const g = new GameState();
    const cells: [number, number][] = [
      [0, 0],
      [2, 0],
      [4, 0],
      [0, 2],
      [2, 2],
      [4, 2],
      [0, 4],
    ];
    for (const [x, y] of cells) g.setPiece(coordNew(x, y), cat('A'));
    g.setToMove('A');
    g.setPool('A', pool(0, 1, 0));
    g.apply({ type: 'place', coord: coordNew(5, 5), piece: 'cat' });
    expect(g.winner).toBe('A');
    expect(g.lastEffects.line_highlight).toEqual({ kind: 'eight_cats_on_bed' });
  });

  it('single_line_still_graduates_automatically', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), kitten('A'));
    g.setPiece(coordNew(1, 0), kitten('A'));
    g.setToMove('A');
    g.setPool('A', pool(6, 0, 8));
    place(g, 2, 0);
    expect(g.turnMode().kind).toBe('place');
    expect(g.toMove).toBe('B');
    expect(g.pool('A').cats_in_hand).toBe(3);
  });

  it('completing_two_lines_at_once_requires_a_choice', () => {
    const g = twoLineSetup();
    place(g, 2, 0);
    expect(g.toMove).toBe('A');
    expect(g.winner).toBeNull();
    expect(g.turnMode().kind).toBe('choose_graduation');
    expect(g.requiresAlternateGraduation()).toBe(false);
    const legal = g.legalMoves();
    expect(legal).toHaveLength(2);
    expect(legal.some(m => m.type === 'graduate' && moveEq(m, { type: 'graduate', line: ROW }))).toBe(true);
    expect(legal.some(m => m.type === 'graduate' && moveEq(m, { type: 'graduate', line: COLUMN }))).toBe(true);
    for (const c of [...ROW, ...COLUMN]) expect(g.boardGet(c)).toEqual(kitten('A'));
    expect(g.pool('A')).toEqual(pool(3, 0, 8));
    expect(g.lastEffects.graduated_cells).toBeNull();
    expect(g.lastEffects.line_highlight).toBeNull();
  });

  it('pending_graduation_rejects_placement_and_wrong_lines', () => {
    const g = twoLineSetup();
    place(g, 2, 0);
    expect(() =>
      g.apply({ type: 'place', coord: coordNew(4, 4), piece: 'kitten' }),
    ).toThrow();
    expect(() =>
      g.apply({
        type: 'graduate',
        line: [coordNew(3, 3), coordNew(4, 4), coordNew(5, 5)],
      }),
    ).toThrow();
    expect(g.toMove).toBe('A');
  });

  it('choosing_a_line_graduates_only_that_line', () => {
    const g = twoLineSetup();
    place(g, 2, 0);
    g.apply({ type: 'graduate', line: COLUMN });
    for (const c of COLUMN) expect(g.boardGet(c)).toBeNull();
    expect(g.boardGet(coordNew(0, 0))).toEqual(kitten('A'));
    expect(g.boardGet(coordNew(1, 0))).toEqual(kitten('A'));
    expect(g.pool('A')).toEqual(pool(3, 3, 5));
    expect(g.toMove).toBe('B');
    expect(g.turnMode().kind).toBe('place');
    expect(g.lastEffects.graduated_cells).toEqual(COLUMN);
    expect(g.lastEffects.line_highlight).toEqual({ kind: 'graduation', line: COLUMN });
    expect(g.lastEffects.displacements).toHaveLength(0);
  });

  it('graduation_choice_click_mapping', () => {
    const g = twoLineSetup();
    place(g, 2, 0);
    expect(g.moveForInteraction('A', coordNew(2, 2), 'kitten')).toEqual({ type: 'graduate', line: COLUMN });
    expect(g.moveForInteraction('A', coordNew(0, 0), 'kitten')).toEqual({ type: 'graduate', line: ROW });
    expect(g.graduationChoiceAt(coordNew(1, 0))).toEqual(ROW);
    expect(g.moveForInteraction('A', coordNew(2, 0), 'kitten')).toBeNull();
    expect(g.graduationChoiceAt(coordNew(2, 0))).toBeNull();
    expect(g.moveForInteraction('A', coordNew(4, 4), 'kitten')).toBeNull();
    expect(g.moveForInteraction('B', coordNew(2, 2), 'kitten')).toBeNull();
  });

  it('four_in_a_row_offers_both_triples', () => {
    const g = new GameState();
    for (const x of [0, 1, 2]) g.setPiece(coordNew(x, 0), kitten('A'));
    g.setToMove('A');
    g.setPool('A', pool(5, 0, 8));
    place(g, 3, 0);
    const left = [coordNew(0, 0), coordNew(1, 0), coordNew(2, 0)];
    const right = [coordNew(1, 0), coordNew(2, 0), coordNew(3, 0)];
    expect(g.turnMode().kind).toBe('choose_graduation');
    g.apply({ type: 'graduate', line: right as [typeof coordNew, typeof coordNew, typeof coordNew] });
    expect(g.boardGet(coordNew(0, 0))).toEqual(kitten('A'));
    for (const x of [1, 2, 3]) expect(g.boardGet(coordNew(x, 0))).toBeNull();
    expect(g.pool('A').cats_in_hand).toBe(3);
  });

  it('mixed_line_with_cats_is_a_candidate_but_all_cat_line_is_not', () => {
    const g = new GameState();
    g.setPiece(coordNew(0, 0), cat('A'));
    g.setPiece(coordNew(1, 0), cat('A'));
    g.setToMove('A');
    g.setPool('A', pool(6, 0, 6));
    place(g, 2, 0);
    expect(g.winner).toBeNull();
    expect(g.turnMode().kind).toBe('place');
    expect(g.toMove).toBe('B');
    expect(g.pool('A')).toEqual(pool(5, 3, 5));
  });

  it('turn_mode_reports_full_bed', () => {
    const g = new GameState();
    for (let i = 0; i < 8; i++) {
      g.setPiece(coordNew(i % 6, Math.floor(i / 6) * 2), i < 4 ? kitten('A') : cat('A'));
    }
    g.setToMove('A');
    g.setPool('A', pool(0, 0, 4));
    expect(g.turnMode().kind).toBe('alternate_graduation');
    expect(g.requiresAlternateGraduation()).toBe(true);
  });
});

describe('BoopGame JSON facade', () => {
  it('round_trip_new_game', () => {
    const game = new BoopGame();
    const exported = game.export_state();
    const restored = BoopGame.import_state(exported);
    expect(restored.view_json()).toBe(game.view_json());
  });

  it('view_board_coords_match_rules_and_moves', () => {
    const game = new BoopGame();
    const mv = game.move_for_interaction_json('A', 2, 3, 'kitten');
    expect(mv).toBeTruthy();
    game.apply_move_json(mv!);
    const view = parseGameView(game.view_json());
    expect(view.board[3]![2]!.kind).toBe('kitten');
    expect(view.board[3]![2]!.player).toBe('A');
    const mv2 = game.move_for_interaction_json('B', 1, 0, 'kitten');
    game.apply_move_json(mv2!);
    const view2 = parseGameView(game.view_json());
    expect(view2.board[0]![1]!.player).toBe('B');
    for (const cell of view2.board.flat()) {
      if (!cell) continue;
      expect(['kitten', 'cat']).toContain(cell.kind);
      expect(['A', 'B']).toContain(cell.player);
    }
  });
});
