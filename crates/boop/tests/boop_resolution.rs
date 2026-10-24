use boop::{Coord, GameState, Move, Piece, PieceKind, Player, BOARD_SIZE};

fn count_pieces_on_board(g: &GameState) -> u32 {
    let mut n = 0u32;
    for y in 0..BOARD_SIZE as u8 {
        for x in 0..BOARD_SIZE as u8 {
            if g.board().get(Coord { x, y }).is_some() {
                n += 1;
            }
        }
    }
    n
}

#[test]
fn no_chain_boop_when_push_lands_beside_another_piece() {
    let mut g = GameState::new();
    let pushed = Piece {
        player: Player::Second,
        kind: PieceKind::Kitten,
    };
    let bystander = Piece {
        player: Player::Second,
        kind: PieceKind::Kitten,
    };
    g.set_piece(Coord::new(1, 0), pushed);
    g.set_piece(Coord::new(3, 0), bystander);
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 8,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(0, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert_eq!(g.board().get(Coord::new(2, 0)), Some(pushed));
    assert_eq!(g.board().get(Coord::new(3, 0)), Some(bystander));
    assert_eq!(g.last_move_effects().displacements.len(), 1);
    assert_eq!(g.last_move_effects().displacements[0].from, Coord::new(1, 0));
    assert_eq!(g.last_move_effects().displacements[0].to, Coord::new(2, 0));
}

#[test]
fn multiple_same_kind_boop_displacements_are_distinct() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(1, 0),
        Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        },
    );
    g.set_piece(
        Coord::new(0, 1),
        Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        },
    );
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 8,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(0, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    let displacements = &g.last_move_effects().displacements;
    assert_eq!(displacements.len(), 2);
    assert!(displacements
        .iter()
        .any(|d| d.from == Coord::new(1, 0) && d.to == Coord::new(2, 0)));
    assert!(displacements
        .iter()
        .any(|d| d.from == Coord::new(0, 1) && d.to == Coord::new(0, 2)));
}

/// Snapshot resolve: must not push into a cell that was occupied before any boop applied,
/// even if an earlier in-place pass would have vacated it.
#[test]
fn does_not_push_into_snapshot_occupied_cell() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(1, 0),
        Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        },
    );
    g.set_piece(
        Coord::new(3, 0),
        Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        },
    );
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 8,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(0, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert!(g.board().get(Coord::new(1, 0)).is_none());
    assert_eq!(
        g.board().get(Coord::new(2, 0)),
        Some(Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        })
    );
    assert_eq!(
        g.board().get(Coord::new(3, 0)),
        Some(Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        })
    );
    assert_eq!(g.last_move_effects().displacements.len(), 1);
    assert_eq!(
        g.last_move_effects().displacements[0].from,
        Coord::new(1, 0)
    );
    assert_eq!(g.last_move_effects().displacements[0].to, Coord::new(2, 0));
}

#[test]
fn simultaneous_boops_reserve_destination_cells() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(1, 0),
        Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        },
    );
    g.set_piece(
        Coord::new(0, 2),
        Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        },
    );
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 8,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(0, 1),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    for displacement in &g.last_move_effects().displacements {
        assert_ne!(displacement.from, displacement.to);
        assert!(g.board().get(displacement.to).is_some());
    }
}

#[test]
fn board_never_has_two_pieces_in_one_cell_after_place() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(2, 2),
        Piece {
            player: Player::Second,
            kind: PieceKind::Cat,
        },
    );
    g.set_piece(
        Coord::new(2, 3),
        Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        },
    );
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 8,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(2, 1),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert_eq!(count_pieces_on_board(&g), 3);
}
