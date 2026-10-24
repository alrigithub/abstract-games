//! Behavioural parity with the canonical (Smirk & Dagger) rules used by the shell engine:
//! boop/brace mechanics, win-before-graduation, and graduation choice.

use boop::{Coord, GameState, LineHighlight, Move, Piece, PieceKind, Player, Pool, TurnMode};

fn kitten(player: Player) -> Piece {
    Piece {
        player,
        kind: PieceKind::Kitten,
    }
}

fn cat(player: Player) -> Piece {
    Piece {
        player,
        kind: PieceKind::Cat,
    }
}

fn pool(kittens: u8, cats: u8, reserve: u8) -> Pool {
    Pool {
        kittens_in_hand: kittens,
        cats_in_hand: cats,
        cats_in_reserve: reserve,
    }
}

// --- Boop / brace -----------------------------------------------------------

/// A piece is only braced by a piece directly *behind* it (away from the placed piece).
/// Pieces on the far side of the placer do not brace it.
#[test]
fn placing_between_two_pieces_boops_both_apart() {
    let mut g = GameState::new();
    g.set_piece(Coord::new(2, 2), kitten(Player::Second));
    g.set_piece(Coord::new(4, 2), kitten(Player::Second));
    g.set_to_move(Player::First);

    g.apply(Move::Place {
        coord: Coord::new(3, 2),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert!(g.board().get(Coord::new(2, 2)).is_none());
    assert!(g.board().get(Coord::new(4, 2)).is_none());
    assert_eq!(
        g.board().get(Coord::new(1, 2)),
        Some(kitten(Player::Second))
    );
    assert_eq!(
        g.board().get(Coord::new(5, 2)),
        Some(kitten(Player::Second))
    );
    assert_eq!(g.last_move_effects().displacements.len(), 2);
}

#[test]
fn placing_between_two_pieces_on_diagonal_boops_one_off_and_one_along() {
    let mut g = GameState::new();
    g.set_piece(Coord::new(0, 0), kitten(Player::Second));
    g.set_piece(Coord::new(2, 2), kitten(Player::First));
    g.set_to_move(Player::First);
    g.set_pool(Player::First, pool(7, 0, 8));
    g.set_pool(Player::Second, pool(7, 0, 8));

    g.apply(Move::Place {
        coord: Coord::new(1, 1),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert!(g.board().get(Coord::new(0, 0)).is_none());
    assert_eq!(g.pool(Player::Second).kittens_in_hand, 8);
    assert_eq!(g.board().get(Coord::new(3, 3)), Some(kitten(Player::First)));
    assert_eq!(g.last_move_effects().off_board.len(), 1);
    assert_eq!(g.last_move_effects().displacements.len(), 1);
}

/// Only the cell directly behind matters: a longer line beyond an empty gap does not brace.
#[test]
fn gap_behind_piece_means_it_is_booped_even_if_line_continues_further() {
    let mut g = GameState::new();
    g.set_piece(Coord::new(1, 0), kitten(Player::Second));
    g.set_piece(Coord::new(3, 0), kitten(Player::Second));
    g.set_piece(Coord::new(4, 0), kitten(Player::First));
    g.set_to_move(Player::First);

    g.apply(Move::Place {
        coord: Coord::new(0, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert!(g.board().get(Coord::new(1, 0)).is_none());
    assert_eq!(
        g.board().get(Coord::new(2, 0)),
        Some(kitten(Player::Second))
    );
    assert_eq!(
        g.board().get(Coord::new(3, 0)),
        Some(kitten(Player::Second))
    );
    assert_eq!(
        g.board().get(Coord::new(4, 0)),
        Some(kitten(Player::First))
    );
}

#[test]
fn kitten_does_not_boop_cat_but_cat_boops_cat() {
    let mut g = GameState::new();
    g.set_piece(Coord::new(3, 3), cat(Player::Second));
    g.set_to_move(Player::First);
    g.set_pool(Player::First, pool(6, 1, 7));

    g.apply(Move::Place {
        coord: Coord::new(2, 3),
        piece: PieceKind::Kitten,
    })
    .unwrap();
    assert_eq!(g.board().get(Coord::new(3, 3)), Some(cat(Player::Second)));

    g.set_to_move(Player::First);
    g.apply(Move::Place {
        coord: Coord::new(3, 2),
        piece: PieceKind::Cat,
    })
    .unwrap();
    assert!(g.board().get(Coord::new(3, 3)).is_none());
    assert_eq!(g.board().get(Coord::new(3, 4)), Some(cat(Player::Second)));
}

// --- Win before graduation --------------------------------------------------

#[test]
fn second_player_diagonal_cat_line_on_own_placement_wins() {
    let mut g = GameState::new();
    g.set_piece(Coord::new(0, 2), cat(Player::Second));
    g.set_piece(Coord::new(1, 1), cat(Player::Second));
    g.set_to_move(Player::Second);
    g.set_pool(Player::Second, pool(7, 1, 6));

    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Cat,
    })
    .unwrap();

    assert_eq!(g.winner(), Some(Player::Second));
}

/// Opponent completes a diagonal cat line via boop displacement (not the piece they placed).
#[test]
fn opponent_diagonal_cat_line_via_boop_wins() {
    let mut g = GameState::new();
    g.set_piece(Coord::new(2, 0), cat(Player::First));
    g.set_piece(Coord::new(3, 1), cat(Player::First));
    g.set_piece(Coord::new(4, 3), cat(Player::First));
    g.set_to_move(Player::Second);
    g.set_pool(Player::Second, pool(7, 1, 7));

    g.apply(Move::Place {
        coord: Coord::new(4, 4),
        piece: PieceKind::Cat,
    })
    .unwrap();

    assert_eq!(g.winner(), Some(Player::First));
    assert_eq!(
        g.last_move_effects().line_highlight,
        Some(LineHighlight::Win([
            Coord::new(2, 0),
            Coord::new(3, 1),
            Coord::new(4, 2),
        ]))
    );
}

/// Three cats in a row is an immediate win even if the same placement also completes
/// a mixed line that shares a cat with the winning line.
#[test]
fn three_cat_line_wins_even_when_it_shares_a_cat_with_a_mixed_line() {
    let mut g = GameState::new();
    g.set_piece(Coord::new(0, 0), cat(Player::First));
    g.set_piece(Coord::new(1, 0), cat(Player::First));
    g.set_piece(Coord::new(2, 1), kitten(Player::First));
    g.set_piece(Coord::new(2, 2), kitten(Player::First));
    g.set_to_move(Player::First);
    g.set_pool(Player::First, pool(2, 2, 4));

    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Cat,
    })
    .unwrap();

    assert_eq!(g.winner(), Some(Player::First));
    assert_eq!(
        g.last_move_effects().line_highlight,
        Some(LineHighlight::Win([
            Coord::new(0, 0),
            Coord::new(1, 0),
            Coord::new(2, 0),
        ]))
    );
    assert!(g.last_move_effects().graduated_cells.is_none());
    for coord in [Coord::new(0, 0), Coord::new(1, 0), Coord::new(2, 0)] {
        assert_eq!(g.board().get(coord), Some(cat(Player::First)));
    }
}

#[test]
fn eight_cats_on_bed_wins_at_end_of_turn() {
    let mut g = GameState::new();
    let cells = [(0, 0), (2, 0), (4, 0), (0, 2), (2, 2), (4, 2), (0, 4)];
    for (x, y) in cells {
        g.set_piece(Coord::new(x, y), cat(Player::First));
    }
    g.set_to_move(Player::First);
    g.set_pool(Player::First, pool(0, 1, 0));

    g.apply(Move::Place {
        coord: Coord::new(5, 5),
        piece: PieceKind::Cat,
    })
    .unwrap();

    assert_eq!(g.winner(), Some(Player::First));
    assert_eq!(
        g.last_move_effects().line_highlight,
        Some(LineHighlight::EightCatsOnBed)
    );
}

// --- Graduation choice ------------------------------------------------------

/// Two kittens in a row plus two kittens in a column, completed by one placement at the corner.
fn two_line_setup() -> GameState {
    let mut g = GameState::new();
    g.set_piece(Coord::new(0, 0), kitten(Player::First));
    g.set_piece(Coord::new(1, 0), kitten(Player::First));
    g.set_piece(Coord::new(2, 1), kitten(Player::First));
    g.set_piece(Coord::new(2, 2), kitten(Player::First));
    g.set_to_move(Player::First);
    g.set_pool(Player::First, pool(4, 0, 8));
    g
}

const ROW: [Coord; 3] = [
    Coord { x: 0, y: 0 },
    Coord { x: 1, y: 0 },
    Coord { x: 2, y: 0 },
];
const COLUMN: [Coord; 3] = [
    Coord { x: 2, y: 0 },
    Coord { x: 2, y: 1 },
    Coord { x: 2, y: 2 },
];

#[test]
fn single_line_still_graduates_automatically() {
    let mut g = GameState::new();
    g.set_piece(Coord::new(0, 0), kitten(Player::First));
    g.set_piece(Coord::new(1, 0), kitten(Player::First));
    g.set_to_move(Player::First);
    g.set_pool(Player::First, pool(6, 0, 8));

    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert_eq!(g.turn_mode(), TurnMode::Place);
    assert_eq!(g.to_move(), Player::Second);
    assert_eq!(g.pool(Player::First).cats_in_hand, 3);
}

#[test]
fn completing_two_lines_at_once_requires_a_choice() {
    let mut g = two_line_setup();

    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert_eq!(g.to_move(), Player::First, "mover keeps the turn to choose");
    assert_eq!(g.winner(), None);
    assert_eq!(g.turn_mode(), TurnMode::ChooseGraduation(vec![ROW, COLUMN]));
    assert!(!g.requires_alternate_graduation());

    let legal = g.legal_moves();
    assert_eq!(legal.len(), 2);
    assert!(legal.contains(&Move::Graduate { line: ROW }));
    assert!(legal.contains(&Move::Graduate { line: COLUMN }));

    // Nothing has been removed or graduated yet.
    for coord in ROW.iter().chain(COLUMN.iter()) {
        assert_eq!(g.board().get(*coord), Some(kitten(Player::First)));
    }
    assert_eq!(g.pool(Player::First), pool(3, 0, 8));
    assert!(g.last_move_effects().graduated_cells.is_none());
    assert!(g.last_move_effects().line_highlight.is_none());
}

#[test]
fn pending_graduation_rejects_placement_and_wrong_lines() {
    let mut g = two_line_setup();
    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert!(
        g.apply(Move::Place {
            coord: Coord::new(4, 4),
            piece: PieceKind::Kitten,
        })
        .is_err()
    );
    assert!(
        g.apply(Move::Graduate {
            line: [Coord::new(3, 3), Coord::new(4, 4), Coord::new(5, 5)],
        })
        .is_err()
    );
    assert_eq!(g.to_move(), Player::First);
}

#[test]
fn choosing_a_line_graduates_only_that_line() {
    let mut g = two_line_setup();
    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    g.apply(Move::Graduate { line: COLUMN }).unwrap();

    for coord in COLUMN {
        assert!(g.board().get(coord).is_none());
    }
    assert_eq!(g.board().get(Coord::new(0, 0)), Some(kitten(Player::First)));
    assert_eq!(g.board().get(Coord::new(1, 0)), Some(kitten(Player::First)));
    assert_eq!(g.pool(Player::First), pool(3, 3, 5));
    assert_eq!(g.to_move(), Player::Second);
    assert_eq!(g.turn_mode(), TurnMode::Place);

    let effects = g.last_move_effects();
    assert_eq!(effects.graduated_cells, Some(COLUMN));
    assert_eq!(
        effects.line_highlight,
        Some(LineHighlight::Graduation(COLUMN))
    );
    assert!(effects.displacements.is_empty());
}

#[test]
fn graduation_choice_click_mapping() {
    let mut g = two_line_setup();
    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    // Cell unique to one line selects it.
    assert_eq!(
        g.move_for_interaction(Player::First, Coord::new(2, 2), PieceKind::Kitten),
        Some(Move::Graduate { line: COLUMN })
    );
    assert_eq!(
        g.move_for_interaction(Player::First, Coord::new(0, 0), PieceKind::Kitten),
        Some(Move::Graduate { line: ROW })
    );
    assert_eq!(g.graduation_choice_at(Coord::new(1, 0)), Some(ROW));
    // Shared corner is ambiguous; empty cells are not a choice.
    assert_eq!(
        g.move_for_interaction(Player::First, Coord::new(2, 0), PieceKind::Kitten),
        None
    );
    assert_eq!(g.graduation_choice_at(Coord::new(2, 0)), None);
    assert_eq!(
        g.move_for_interaction(Player::First, Coord::new(4, 4), PieceKind::Kitten),
        None
    );
    // Opponent cannot choose for you.
    assert_eq!(
        g.move_for_interaction(Player::Second, Coord::new(2, 2), PieceKind::Kitten),
        None
    );
}

#[test]
fn four_in_a_row_offers_both_triples() {
    let mut g = GameState::new();
    for x in 0..3 {
        g.set_piece(Coord::new(x, 0), kitten(Player::First));
    }
    g.set_to_move(Player::First);
    g.set_pool(Player::First, pool(5, 0, 8));

    g.apply(Move::Place {
        coord: Coord::new(3, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    let left = [Coord::new(0, 0), Coord::new(1, 0), Coord::new(2, 0)];
    let right = [Coord::new(1, 0), Coord::new(2, 0), Coord::new(3, 0)];
    assert_eq!(g.turn_mode(), TurnMode::ChooseGraduation(vec![left, right]));

    g.apply(Move::Graduate { line: right }).unwrap();
    assert_eq!(g.board().get(Coord::new(0, 0)), Some(kitten(Player::First)));
    for x in 1..4 {
        assert!(g.board().get(Coord::new(x, 0)).is_none());
    }
    assert_eq!(g.pool(Player::First).cats_in_hand, 3);
}

#[test]
fn mixed_line_with_cats_is_a_candidate_but_all_cat_line_is_not() {
    let mut g = GameState::new();
    // Row: cat, cat + placed kitten -> mixed, graduates.
    g.set_piece(Coord::new(0, 0), cat(Player::First));
    g.set_piece(Coord::new(1, 0), cat(Player::First));
    // Column from (2,0): cats below -> all cats once a cat is placed, but we place a kitten.
    g.set_to_move(Player::First);
    g.set_pool(Player::First, pool(6, 0, 6));

    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert_eq!(g.winner(), None);
    assert_eq!(g.turn_mode(), TurnMode::Place);
    assert_eq!(g.to_move(), Player::Second);
    // Two cats return, one kitten graduates.
    assert_eq!(g.pool(Player::First), pool(5, 3, 5));
}

#[test]
fn turn_mode_reports_full_bed() {
    let mut g = GameState::new();
    for i in 0..8u8 {
        g.set_piece(
            Coord::new(i % 6, (i / 6) * 2),
            if i < 4 {
                kitten(Player::First)
            } else {
                cat(Player::First)
            },
        );
    }
    g.set_to_move(Player::First);
    g.set_pool(Player::First, pool(0, 0, 4));

    assert_eq!(g.turn_mode(), TurnMode::AlternateGraduation);
    assert!(g.requires_alternate_graduation());
}
