//! Ports of the React shell `engine.test.ts` cases, adapted to the official
//! Smirk & Dagger rulebook wherever the shell disagrees.
//!
//! Shell coordinates are `(row, col)`. Rust [`Coord`] is `(x, y) = (col, row)`.

use boop::{
    Coord, GameState, IllegalMove, Move, Piece, PieceKind, Player, Pool, TurnMode, BOARD_SIZE,
};

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

fn active_pieces(g: &GameState, player: Player) -> u8 {
    let p = g.pool(player);
    p.kittens_in_hand + p.cats_in_hand + g.board().count_pieces(player) as u8
}

fn pieces_on_bed(g: &GameState, player: Player) -> u32 {
    g.board().count_pieces(player)
}

fn cats_on_bed(g: &GameState, player: Player) -> u32 {
    g.board().count_cats(player)
}

fn place(g: &mut GameState, x: u8, y: u8, kind: PieceKind) -> Result<(), IllegalMove> {
    g.apply(Move::Place {
        coord: Coord::new(x, y),
        piece: kind,
    })
}

fn fixture(pieces: &[(u8, u8, Piece)], pools: [(Player, Pool); 2], to_move: Player) -> GameState {
    let mut g = GameState::new();
    for &(x, y, piece) in pieces {
        g.set_piece(Coord::new(x, y), piece);
    }
    for (player, p) in pools {
        g.set_pool(player, p);
    }
    g.set_to_move(to_move);
    g
}

// --- engine.test.ts ---------------------------------------------------------

#[test]
fn starts_on_6x6_with_8_kittens_each_and_first_to_move() {
    let g = GameState::new();
    assert_eq!(BOARD_SIZE, 6);
    assert_eq!(g.pool(Player::First), pool(8, 0, 8));
    assert_eq!(g.pool(Player::Second), pool(8, 0, 8));
    assert_eq!(g.to_move(), Player::First);
    assert_eq!(g.winner(), None);
    assert_eq!(g.turn_mode(), TurnMode::Place);
}

#[test]
fn places_a_kitten_and_depletes_pool() {
    let mut g = GameState::new();
    place(&mut g, 2, 2, PieceKind::Kitten).unwrap();
    assert_eq!(g.board().get(Coord::new(2, 2)), Some(kitten(Player::First)));
    assert_eq!(g.pool(Player::First).kittens_in_hand, 7);
    assert_eq!(g.to_move(), Player::Second);
}

#[test]
fn boops_an_orthogonal_neighbor_one_step_away() {
    let mut g = GameState::new();
    place(&mut g, 2, 2, PieceKind::Kitten).unwrap();
    place(&mut g, 3, 2, PieceKind::Kitten).unwrap();
    assert_eq!(
        g.board().get(Coord::new(3, 2)),
        Some(kitten(Player::Second))
    );
    assert!(g.board().get(Coord::new(2, 2)).is_none());
    assert_eq!(g.board().get(Coord::new(1, 2)), Some(kitten(Player::First)));
}

#[test]
fn boops_a_diagonal_neighbor_one_step_away() {
    let mut g = GameState::new();
    place(&mut g, 2, 2, PieceKind::Kitten).unwrap();
    place(&mut g, 3, 3, PieceKind::Kitten).unwrap();
    assert_eq!(
        g.board().get(Coord::new(3, 3)),
        Some(kitten(Player::Second))
    );
    assert!(g.board().get(Coord::new(2, 2)).is_none());
    assert_eq!(g.board().get(Coord::new(1, 1)), Some(kitten(Player::First)));
}

#[test]
fn boops_off_bed_back_to_owner_pool() {
    let mut g = GameState::new();
    place(&mut g, 0, 0, PieceKind::Kitten).unwrap();
    assert_eq!(g.pool(Player::First).kittens_in_hand, 7);
    place(&mut g, 1, 0, PieceKind::Kitten).unwrap();
    assert!(g.board().get(Coord::new(0, 0)).is_none());
    assert_eq!(
        g.board().get(Coord::new(1, 0)),
        Some(kitten(Player::Second))
    );
    assert_eq!(g.pool(Player::First).kittens_in_hand, 8);
}

#[test]
fn does_not_chain_reaction_push_beyond_first_boop() {
    let mut g = fixture(
        &[
            (1, 2, kitten(Player::First)),
            (2, 2, kitten(Player::Second)),
        ],
        [
            (Player::First, pool(7, 0, 8)),
            (Player::Second, pool(7, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 0, 2, PieceKind::Kitten).unwrap();
    assert_eq!(g.board().get(Coord::new(1, 2)), Some(kitten(Player::First)));
    assert_eq!(
        g.board().get(Coord::new(2, 2)),
        Some(kitten(Player::Second))
    );
    assert!(g.board().get(Coord::new(3, 2)).is_none());
}

#[test]
fn kitten_cannot_boop_a_cat() {
    let mut g = fixture(
        &[(2, 2, cat(Player::First))],
        [
            (Player::First, pool(8, 0, 8)),
            (Player::Second, pool(7, 0, 8)),
        ],
        Player::Second,
    );
    place(&mut g, 3, 2, PieceKind::Kitten).unwrap();
    assert_eq!(g.board().get(Coord::new(2, 2)), Some(cat(Player::First)));
    assert_eq!(
        g.board().get(Coord::new(3, 2)),
        Some(kitten(Player::Second))
    );
}

#[test]
fn cat_can_boop_a_kitten() {
    let mut g = fixture(
        &[(2, 2, kitten(Player::First))],
        [
            (Player::First, pool(8, 0, 8)),
            (Player::Second, pool(7, 1, 8)),
        ],
        Player::Second,
    );
    place(&mut g, 3, 2, PieceKind::Cat).unwrap();
    assert!(g.board().get(Coord::new(2, 2)).is_none());
    assert_eq!(g.board().get(Coord::new(1, 2)), Some(kitten(Player::First)));
}

#[test]
fn braces_a_line_of_two_against_push_along_that_line() {
    let mut g = fixture(
        &[(0, 2, kitten(Player::First)), (1, 2, kitten(Player::First))],
        [
            (Player::First, pool(6, 0, 8)),
            (Player::Second, pool(7, 0, 8)),
        ],
        Player::Second,
    );
    place(&mut g, 2, 2, PieceKind::Kitten).unwrap();
    assert_eq!(g.board().get(Coord::new(1, 2)), Some(kitten(Player::First)));
    assert_eq!(g.board().get(Coord::new(0, 2)), Some(kitten(Player::First)));
}

#[test]
fn graduates_mixed_kitten_and_cat_trio_without_winning() {
    let mut g = fixture(
        &[(0, 2, kitten(Player::First)), (1, 2, cat(Player::First))],
        [
            (Player::First, pool(6, 0, 8)),
            (Player::Second, pool(8, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 2, 2, PieceKind::Kitten).unwrap();
    assert_eq!(g.winner(), None);
    assert_eq!(g.pool(Player::First).cats_in_hand, 3);
    assert_eq!(active_pieces(&g, Player::First), 8);
}

#[test]
fn graduates_on_3_kittens_in_a_row_after_boops_not_a_win() {
    let mut g = fixture(
        &[(1, 1, kitten(Player::First)), (2, 1, kitten(Player::First))],
        [
            (Player::First, pool(6, 0, 8)),
            (Player::Second, pool(8, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 3, 1, PieceKind::Kitten).unwrap();
    assert!(g.board().get(Coord::new(1, 1)).is_none());
    assert!(g.board().get(Coord::new(2, 1)).is_none());
    assert!(g.board().get(Coord::new(3, 1)).is_none());
    assert_eq!(g.pool(Player::First).cats_in_hand, 3);
    assert_eq!(g.pool(Player::First).kittens_in_hand, 5);
    assert_eq!(g.pool(Player::First).cats_in_reserve, 5);
    assert_eq!(active_pieces(&g, Player::First), 8);
    assert_eq!(g.to_move(), Player::Second);
    assert_eq!(g.winner(), None);
}

/// Shell auto-picks the triple that includes the placed cell. Rulebook: the mover
/// chooses one group of exactly three. Both overlapping triples must be offered.
#[test]
fn longer_line_offers_graduation_choice_including_the_placed_cell() {
    let mut g = fixture(
        &[
            (0, 1, kitten(Player::First)),
            (1, 1, kitten(Player::First)),
            (2, 1, kitten(Player::First)),
        ],
        [
            (Player::First, pool(5, 0, 8)),
            (Player::Second, pool(8, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 3, 1, PieceKind::Kitten).unwrap();

    let left = [Coord::new(0, 1), Coord::new(1, 1), Coord::new(2, 1)];
    let through_placed = [Coord::new(1, 1), Coord::new(2, 1), Coord::new(3, 1)];
    assert_eq!(
        g.turn_mode(),
        TurnMode::ChooseGraduation(vec![left, through_placed])
    );

    g.apply(Move::Graduate {
        line: through_placed,
    })
    .unwrap();
    assert!(g.board().get(Coord::new(3, 1)).is_none());
    assert_eq!(g.board().get(Coord::new(0, 1)), Some(kitten(Player::First)));
    assert_eq!(g.pool(Player::First).cats_in_hand, 3);
    assert_eq!(g.pool(Player::First).kittens_in_hand, 4);
    assert_eq!(active_pieces(&g, Player::First), 8);
}

#[test]
fn wins_on_3_cats_in_a_row_after_boops() {
    let mut g = fixture(
        &[(0, 0, cat(Player::First)), (1, 0, cat(Player::First))],
        [
            (Player::First, pool(0, 1, 5)),
            (Player::Second, pool(8, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 2, 0, PieceKind::Cat).unwrap();
    assert_eq!(g.winner(), Some(Player::First));
    assert_eq!(
        g.last_move_effects().line_highlight,
        Some(boop::LineHighlight::Win([
            Coord::new(0, 0),
            Coord::new(1, 0),
            Coord::new(2, 0),
        ]))
    );
}

#[test]
fn wins_when_the_8th_cat_is_placed_on_the_bed() {
    let coords = [(0, 0), (2, 0), (4, 0), (1, 2), (3, 2), (0, 4), (2, 4)];
    let pieces: Vec<_> = coords
        .into_iter()
        .map(|(x, y)| (x, y, cat(Player::First)))
        .collect();
    let mut g = fixture(
        &pieces,
        [
            (Player::First, pool(0, 1, 0)),
            (Player::Second, pool(8, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 5, 5, PieceKind::Cat).unwrap();
    assert_eq!(g.winner(), Some(Player::First));
    assert_eq!(cats_on_bed(&g, Player::First), 8);
}

#[test]
fn only_the_active_player_can_win_on_their_turn() {
    let mut g = fixture(
        &[
            (0, 0, cat(Player::Second)),
            (1, 0, cat(Player::Second)),
            (2, 0, cat(Player::Second)),
        ],
        [
            (Player::First, pool(7, 0, 8)),
            (Player::Second, pool(8, 0, 5)),
        ],
        Player::First,
    );
    place(&mut g, 1, 1, PieceKind::Kitten).unwrap();
    assert_eq!(g.winner(), None);
    assert_eq!(g.to_move(), Player::Second);
}

#[test]
fn rejects_illegal_place_occupied_no_piece_in_pool() {
    let mut g = GameState::new();
    assert_eq!(place(&mut g, 0, 0, PieceKind::Cat), Err(IllegalMove));
    place(&mut g, 0, 0, PieceKind::Kitten).unwrap();
    g.set_to_move(Player::First);
    assert_eq!(place(&mut g, 0, 0, PieceKind::Kitten), Err(IllegalMove));
}

/// Shell auto-graduates the first kitten in row-major order. Rulebook: the mover
/// chooses any one kitten (or a cat) at the end of the same turn, after booping.
#[test]
fn placing_eighth_piece_without_a_trio_keeps_the_turn_for_alternate_graduation() {
    let coords = [(0, 0), (2, 0), (4, 0), (0, 2), (2, 2), (4, 2), (0, 4)];
    let pieces: Vec<_> = coords
        .into_iter()
        .map(|(x, y)| (x, y, kitten(Player::First)))
        .collect();
    let mut g = fixture(
        &pieces,
        [
            (Player::First, pool(1, 0, 8)),
            (Player::Second, pool(8, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 4, 4, PieceKind::Kitten).unwrap();

    assert_eq!(g.winner(), None);
    assert_eq!(g.to_move(), Player::First);
    assert_eq!(g.turn_mode(), TurnMode::AlternateGraduation);
    assert_eq!(pieces_on_bed(&g, Player::First), 8);
    assert_eq!(g.pool(Player::First), pool(0, 0, 8));
    assert_eq!(active_pieces(&g, Player::First), 8);

    let legal = g.legal_moves();
    assert!(legal.iter().all(|m| matches!(
        m,
        Move::GraduateSingleKitten { .. } | Move::ReturnCatToPool { .. }
    )));
    assert!(legal.contains(&Move::GraduateSingleKitten {
        coord: Coord::new(0, 0)
    }));
    assert!(legal.contains(&Move::GraduateSingleKitten {
        coord: Coord::new(4, 4)
    }));

    g.apply(Move::GraduateSingleKitten {
        coord: Coord::new(0, 0),
    })
    .unwrap();
    assert!(g.board().get(Coord::new(0, 0)).is_none());
    assert_eq!(g.pool(Player::First).cats_in_hand, 1);
    assert_eq!(g.pool(Player::First).kittens_in_hand, 0);
    assert_eq!(g.pool(Player::First).cats_in_reserve, 7);
    assert_eq!(pieces_on_bed(&g, Player::First), 7);
    assert_eq!(active_pieces(&g, Player::First), 8);
    assert_eq!(g.to_move(), Player::Second);
}

#[test]
fn legal_moves_empty_when_won() {
    let mut g = GameState::new();
    g.set_piece(Coord::new(0, 0), cat(Player::First));
    g.set_piece(Coord::new(1, 0), cat(Player::First));
    g.set_to_move(Player::First);
    g.set_pool(Player::First, pool(0, 1, 5));
    place(&mut g, 2, 0, PieceKind::Cat).unwrap();
    assert_eq!(g.winner(), Some(Player::First));
    assert!(g.legal_moves().is_empty());
}

// --- extra rulebook cases the shell omitted ---------------------------------

#[test]
fn opponent_three_cats_formed_by_your_boop_does_not_win() {
    // Second has cats at (0,0) and (2,0); the gap cat sits at (1,1). First
    // places a cat at (1,2) and boops that cat up into (1,0), completing
    // Second's line. A kitten could not do this (kittens do not boop cats).
    let mut g = fixture(
        &[
            (0, 0, cat(Player::Second)),
            (2, 0, cat(Player::Second)),
            (1, 1, cat(Player::Second)),
        ],
        [
            (Player::First, pool(7, 1, 8)),
            (Player::Second, pool(8, 0, 5)),
        ],
        Player::First,
    );
    place(&mut g, 1, 2, PieceKind::Cat).unwrap();
    assert_eq!(g.board().get(Coord::new(1, 0)), Some(cat(Player::Second)));
    assert_eq!(g.winner(), None);
    assert_eq!(g.to_move(), Player::Second);
}

#[test]
fn opponent_three_kittens_formed_by_your_boop_do_not_graduate() {
    let mut g = fixture(
        &[
            (0, 0, kitten(Player::Second)),
            (2, 0, kitten(Player::Second)),
            (1, 1, kitten(Player::Second)),
        ],
        [
            (Player::First, pool(8, 0, 8)),
            (Player::Second, pool(5, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 1, 2, PieceKind::Kitten).unwrap();
    assert_eq!(
        g.board().get(Coord::new(1, 0)),
        Some(kitten(Player::Second))
    );
    assert_eq!(
        g.board().get(Coord::new(0, 0)),
        Some(kitten(Player::Second))
    );
    assert_eq!(
        g.board().get(Coord::new(2, 0)),
        Some(kitten(Player::Second))
    );
    assert_eq!(g.pool(Player::Second), pool(5, 0, 8));
    assert_eq!(g.winner(), None);
}

#[test]
fn your_three_kittens_formed_by_your_own_boop_do_graduate() {
    let mut g = fixture(
        &[
            (0, 0, kitten(Player::First)),
            (2, 0, kitten(Player::First)),
            (1, 1, kitten(Player::First)),
        ],
        [
            (Player::First, pool(5, 0, 8)),
            (Player::Second, pool(8, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 1, 2, PieceKind::Kitten).unwrap();
    assert!(g.board().get(Coord::new(0, 0)).is_none());
    assert!(g.board().get(Coord::new(1, 0)).is_none());
    assert!(g.board().get(Coord::new(2, 0)).is_none());
    assert_eq!(g.pool(Player::First).cats_in_hand, 3);
    assert_eq!(g.pool(Player::First).cats_in_reserve, 5);
    assert_eq!(active_pieces(&g, Player::First), 8);
    assert_eq!(g.to_move(), Player::Second);
}

/// Rulebook: if you have both a three-in-a-row *and* eight pieces on the bed,
/// choose which to activate. The shell auto-graduates the trio.
#[test]
fn eighth_piece_that_also_completes_a_trio_offers_line_or_alternate() {
    let extras = [(0, 2), (2, 2), (4, 2), (0, 4), (2, 4)];
    let mut pieces = vec![(0, 0, kitten(Player::First)), (1, 0, kitten(Player::First))];
    pieces.extend(
        extras
            .into_iter()
            .map(|(x, y)| (x, y, kitten(Player::First))),
    );
    let mut g = fixture(
        &pieces,
        [
            (Player::First, pool(1, 0, 8)),
            (Player::Second, pool(8, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 2, 0, PieceKind::Kitten).unwrap();

    let line = [Coord::new(0, 0), Coord::new(1, 0), Coord::new(2, 0)];
    assert_eq!(g.to_move(), Player::First);
    assert_eq!(g.turn_mode(), TurnMode::ChooseGraduation(vec![line]));
    assert_eq!(pieces_on_bed(&g, Player::First), 8);

    let legal = g.legal_moves();
    assert!(legal.contains(&Move::Graduate { line }));
    assert!(legal.contains(&Move::GraduateSingleKitten {
        coord: Coord::new(0, 2)
    }));
    assert!(!legal.iter().any(|m| matches!(m, Move::Place { .. })));

    // Off-line piece: alternate. On-line unique cell: graduate the trio.
    assert_eq!(
        g.move_for_interaction(Player::First, Coord::new(0, 2), PieceKind::Kitten),
        Some(Move::GraduateSingleKitten {
            coord: Coord::new(0, 2)
        })
    );
    assert_eq!(
        g.move_for_interaction(Player::First, Coord::new(1, 0), PieceKind::Kitten),
        Some(Move::Graduate { line })
    );

    g.apply(Move::GraduateSingleKitten {
        coord: Coord::new(0, 2),
    })
    .unwrap();
    assert!(g.board().get(Coord::new(0, 2)).is_none());
    assert_eq!(g.board().get(Coord::new(0, 0)), Some(kitten(Player::First)));
    assert_eq!(g.board().get(Coord::new(1, 0)), Some(kitten(Player::First)));
    assert_eq!(g.board().get(Coord::new(2, 0)), Some(kitten(Player::First)));
    assert_eq!(g.pending_graduation_lines(), &[] as &[[Coord; 3]]);
    assert_eq!(g.to_move(), Player::Second);
    assert_eq!(active_pieces(&g, Player::First), 8);
}

#[test]
fn graduation_and_alternate_keep_eight_active_pieces() {
    let mut g = fixture(
        &[(0, 0, kitten(Player::First)), (1, 0, kitten(Player::First))],
        [
            (Player::First, pool(6, 0, 8)),
            (Player::Second, pool(8, 0, 8)),
        ],
        Player::First,
    );
    place(&mut g, 2, 0, PieceKind::Kitten).unwrap();
    assert_eq!(active_pieces(&g, Player::First), 8);
    let p = g.pool(Player::First);
    assert_eq!(p.kittens_in_hand, 5);
    assert_eq!(p.cats_in_hand, 3);
    assert_eq!(p.cats_in_reserve, 5);
}
