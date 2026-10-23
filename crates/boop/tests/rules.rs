use boop::{Coord, GameState, Move, Piece, PieceKind, Player};

#[test]
fn place_kitten() {
    let mut g = GameState::new();
    let coord = Coord::new(2, 2);
    g.apply(Move::Place {
        coord,
        piece: PieceKind::Kitten,
    })
    .unwrap();
    assert_eq!(
        g.board().get(coord),
        Some(Piece {
            player: Player::First,
            kind: PieceKind::Kitten,
        })
    );
    assert_eq!(g.pool(Player::First).kittens_in_hand, 7);
    assert_eq!(g.to_move(), Player::Second);
}

#[test]
fn boop_off_edge_records_push_direction() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(0, 0),
        Piece {
            player: Player::First,
            kind: PieceKind::Kitten,
        },
    );
    g.set_to_move(Player::Second);
    g.set_pool(
        Player::Second,
        boop::Pool {
            kittens_in_hand: 7,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 7,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(1, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert_eq!(g.last_move_effects().off_board.len(), 1);
    assert_eq!(g.last_move_effects().off_board[0].from, Coord::new(0, 0));
    assert_eq!(g.last_move_effects().off_board[0].push, (-1, 0));
}

#[test]
fn boop_off_edge() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(0, 0),
        Piece {
            player: Player::First,
            kind: PieceKind::Kitten,
        },
    );
    g.set_to_move(Player::Second);
    g.set_pool(
        Player::Second,
        boop::Pool {
            kittens_in_hand: 7,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 7,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(1, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert!(g.board().get(Coord::new(0, 0)).is_none());
    assert_eq!(g.pool(Player::First).kittens_in_hand, 8);
}

#[test]
fn graduation_emits_line_highlight() {
    let mut g = GameState::new();
    for x in 0..2 {
        g.set_piece(
            Coord::new(x, 0),
            Piece {
                player: Player::First,
                kind: PieceKind::Kitten,
            },
        );
    }
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 6,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert!(matches!(
        g.last_move_effects().line_highlight,
        Some(boop::LineHighlight::Graduation(_))
    ));
}

#[test]
fn graduate_three_kittens() {
    let mut g = GameState::new();
    for x in 0..2 {
        g.set_piece(
            Coord::new(x, 0),
            Piece {
                player: Player::First,
                kind: PieceKind::Kitten,
            },
        );
    }
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 6,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    for x in 0..3 {
        assert!(g.board().get(Coord::new(x, 0)).is_none());
    }
    assert_eq!(g.pool(Player::First).cats_in_hand, 3);
    assert_eq!(g.pool(Player::First).kittens_in_hand, 5);
    assert_eq!(g.pool(Player::First).cats_in_reserve, 5);
}

#[test]
fn graduate_mixed_line_promotes_per_kitten_and_returns_cats() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(0, 0),
        Piece {
            player: Player::First,
            kind: PieceKind::Kitten,
        },
    );
    g.set_piece(
        Coord::new(1, 0),
        Piece {
            player: Player::First,
            kind: PieceKind::Cat,
        },
    );
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 6,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    for x in 0..3 {
        assert!(g.board().get(Coord::new(x, 0)).is_none());
    }
    assert_eq!(g.pool(Player::First).cats_in_hand, 3);
    assert_eq!(g.pool(Player::First).cats_in_reserve, 6);
    assert_eq!(g.pool(Player::First).kittens_in_hand, 5);
}

#[test]
fn four_in_a_row_graduates_first_three_only() {
    let mut g = GameState::new();
    for x in 0..3 {
        g.set_piece(
            Coord::new(x, 0),
            Piece {
                player: Player::First,
                kind: PieceKind::Kitten,
            },
        );
    }
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 5,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(3, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert!(g.board().get(Coord::new(3, 0)).is_some());
    for x in 0..3 {
        assert!(g.board().get(Coord::new(x, 0)).is_none());
    }
    assert_eq!(g.pool(Player::First).cats_in_hand, 3);
}

#[test]
fn three_cats_in_a_row_is_win_not_graduation() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(0, 0),
        Piece {
            player: Player::First,
            kind: PieceKind::Cat,
        },
    );
    g.set_piece(
        Coord::new(1, 0),
        Piece {
            player: Player::First,
            kind: PieceKind::Cat,
        },
    );
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 8,
            cats_in_hand: 1,
            cats_in_reserve: 5,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Cat,
    })
    .unwrap();

    assert_eq!(g.winner(), Some(Player::First));
    assert!(g.board().get(Coord::new(0, 0)).is_some());
    assert!(g.board().get(Coord::new(1, 0)).is_some());
    assert!(g.board().get(Coord::new(2, 0)).is_some());
}

#[test]
fn win_with_three_cats_in_a_row() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(0, 0),
        Piece {
            player: Player::First,
            kind: PieceKind::Cat,
        },
    );
    g.set_piece(
        Coord::new(1, 0),
        Piece {
            player: Player::First,
            kind: PieceKind::Cat,
        },
    );
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 8,
            cats_in_hand: 1,
            cats_in_reserve: 5,
        },
    );

    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Cat,
    })
    .unwrap();

    assert_eq!(g.winner(), Some(Player::First));
}

#[test]
fn brace_blocks_push_along_line() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(1, 0),
        Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        },
    );
    g.set_piece(
        Coord::new(2, 0),
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

    assert_eq!(
        g.board().get(Coord::new(1, 0)),
        Some(Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        })
    );
    assert_eq!(
        g.board().get(Coord::new(2, 0)),
        Some(Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        })
    );
}

#[test]
fn brace_does_not_block_perpendicular_boop() {
    let mut g = GameState::new();
    g.set_piece(
        Coord::new(1, 0),
        Piece {
            player: Player::Second,
            kind: PieceKind::Kitten,
        },
    );
    g.set_piece(
        Coord::new(2, 0),
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
        coord: Coord::new(1, 1),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert!(g.board().get(Coord::new(1, 0)).is_none());
}

#[test]
fn alternate_graduation_when_bed_full() {
    let mut g = GameState::new();
    for i in 0..8u8 {
        g.set_piece(
            Coord::new(i % 6, i / 6),
            Piece {
                player: Player::First,
                kind: if i < 4 {
                    PieceKind::Kitten
                } else {
                    PieceKind::Cat
                },
            },
        );
    }
    g.set_to_move(Player::First);
    g.set_pool(
        Player::First,
        boop::Pool {
            kittens_in_hand: 0,
            cats_in_hand: 0,
            cats_in_reserve: 4,
        },
    );

    let moves = g.legal_moves();
    assert!(moves.iter().any(|m| matches!(
        m,
        Move::GraduateSingleKitten { coord } if *coord == Coord::new(0, 0)
    )));
    assert!(moves.iter().any(|m| matches!(
        m,
        Move::ReturnCatToPool { coord } if *coord == Coord::new(4, 0)
    )));
    assert!(moves.iter().all(|m| !matches!(m, Move::Place { .. })));
}

#[test]
fn apply_alternate_graduate_kitten() {
    let mut g = GameState::new();
    let kitten_at = Coord::new(0, 0);
    let layout: [(u8, u8, PieceKind); 8] = [
        (0, 0, PieceKind::Kitten),
        (0, 2, PieceKind::Kitten),
        (0, 4, PieceKind::Kitten),
        (2, 0, PieceKind::Kitten),
        (2, 2, PieceKind::Kitten),
        (4, 0, PieceKind::Cat),
        (4, 2, PieceKind::Cat),
        (5, 5, PieceKind::Cat),
    ];
    for (x, y, kind) in layout {
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

    g.apply(Move::GraduateSingleKitten { coord: kitten_at })
        .unwrap();

    assert!(g.board().get(kitten_at).is_none());
    assert_eq!(g.pool(Player::First).cats_in_hand, 1);
    assert_eq!(g.pool(Player::First).cats_in_reserve, 1);
    assert_eq!(g.to_move(), Player::Second);
}

#[test]
fn apply_return_cat_to_pool_when_bed_full() {
    let mut g = GameState::new();
    let cat_at = Coord::new(5, 5);
    let layout: [(u8, u8, PieceKind); 8] = [
        (0, 0, PieceKind::Kitten),
        (0, 2, PieceKind::Kitten),
        (0, 4, PieceKind::Kitten),
        (2, 0, PieceKind::Kitten),
        (2, 2, PieceKind::Kitten),
        (4, 0, PieceKind::Cat),
        (4, 2, PieceKind::Cat),
        (5, 5, PieceKind::Cat),
    ];
    for (x, y, kind) in layout {
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
            cats_in_hand: 1,
            cats_in_reserve: 0,
        },
    );

    g.apply(Move::ReturnCatToPool { coord: cat_at }).unwrap();

    assert!(g.board().get(cat_at).is_none());
    assert_eq!(g.pool(Player::First).cats_in_hand, 2);
    assert_eq!(g.to_move(), Player::Second);
}
