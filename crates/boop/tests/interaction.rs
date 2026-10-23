use boop::{Coord, GameState, Move, Piece, PieceKind, Player};

fn full_bed_layout() -> [(u8, u8, PieceKind); 8] {
    [
        (0, 0, PieceKind::Kitten),
        (0, 2, PieceKind::Kitten),
        (0, 4, PieceKind::Kitten),
        (2, 0, PieceKind::Kitten),
        (2, 2, PieceKind::Kitten),
        (4, 0, PieceKind::Cat),
        (4, 2, PieceKind::Cat),
        (5, 5, PieceKind::Cat),
    ]
}

#[test]
fn requires_alternate_graduation_when_bed_full() {
    let mut g = GameState::new();
    for (x, y, kind) in full_bed_layout() {
        g.set_piece(
            Coord::new(x, y),
            Piece {
                player: Player::First,
                kind,
            },
        );
    }
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 0,
            cats_in_hand: 0,
            cats_in_reserve: 2,
        },
    );

    assert!(g.requires_alternate_graduation());
}

#[test]
fn move_for_interaction_places_on_empty_cell() {
    let g = GameState::new();
    let coord = Coord::new(2, 2);
    assert_eq!(
        g.move_for_interaction(Player::First, coord, PieceKind::Kitten),
        Some(Move::Place {
            coord,
            piece: PieceKind::Kitten,
        })
    );
}

#[test]
fn normalize_placement_prefers_cats_when_out_of_kittens() {
    let pool = boop::Pool {
        kittens_in_hand: 0,
        cats_in_hand: 2,
        cats_in_reserve: 8,
    };
    assert_eq!(
        pool.normalize_placement_preference(PieceKind::Kitten),
        PieceKind::Cat
    );
}

#[test]
fn normalize_placement_prefers_kittens_when_out_of_cats() {
    let pool = boop::Pool {
        kittens_in_hand: 3,
        cats_in_hand: 0,
        cats_in_reserve: 8,
    };
    assert_eq!(
        pool.normalize_placement_preference(PieceKind::Cat),
        PieceKind::Kitten
    );
}

#[test]
fn move_for_interaction_falls_back_to_cat_when_no_kittens() {
    let mut g = GameState::new();
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 0,
            cats_in_hand: 2,
            cats_in_reserve: 8,
        },
    );
    let coord = Coord::new(1, 1);
    assert_eq!(
        g.move_for_interaction(Player::First, coord, PieceKind::Kitten),
        Some(Move::Place {
            coord,
            piece: PieceKind::Cat,
        })
    );
}

#[test]
fn move_for_interaction_full_bed_kitten_graduation() {
    let mut g = GameState::new();
    for (x, y, kind) in full_bed_layout() {
        g.set_piece(
            Coord::new(x, y),
            Piece {
                player: Player::First,
                kind,
            },
        );
    }
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 0,
            cats_in_hand: 0,
            cats_in_reserve: 2,
        },
    );

    let coord = Coord::new(0, 0);
    assert_eq!(
        g.move_for_interaction(Player::First, coord, PieceKind::Kitten),
        Some(Move::GraduateSingleKitten { coord })
    );
}

#[test]
fn move_for_interaction_full_bed_return_cat() {
    let mut g = GameState::new();
    for (x, y, kind) in full_bed_layout() {
        g.set_piece(
            Coord::new(x, y),
            Piece {
                player: Player::First,
                kind,
            },
        );
    }
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 0,
            cats_in_hand: 0,
            cats_in_reserve: 2,
        },
    );

    let coord = Coord::new(5, 5);
    assert_eq!(
        g.move_for_interaction(Player::First, coord, PieceKind::Kitten),
        Some(Move::ReturnCatToPool { coord })
    );
}

#[test]
fn apply_rejects_moves_not_in_legal_moves() {
    let mut g = GameState::new();
    for (x, y, kind) in full_bed_layout() {
        g.set_piece(
            Coord::new(x, y),
            Piece {
                player: Player::First,
                kind,
            },
        );
    }
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 0,
            cats_in_hand: 0,
            cats_in_reserve: 2,
        },
    );

    assert!(g
        .apply(Move::Place {
            coord: Coord::new(3, 3),
            piece: PieceKind::Kitten,
        })
        .is_err());
}
