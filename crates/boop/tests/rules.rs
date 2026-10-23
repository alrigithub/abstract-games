use boop::{Coord, GameState, Move, Piece, PieceKind, Player};

#[test]
fn place_kitten() {
    let mut g = GameState::new();
    let coord = Coord::new(2, 2);
    g.apply(Move {
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

    g.apply(Move {
        coord: Coord::new(1, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    assert!(g.board().get(Coord::new(0, 0)).is_none());
    assert_eq!(g.pool(Player::First).kittens_in_hand, 8);
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

    g.apply(Move {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();

    for x in 0..3 {
        assert!(g.board().get(Coord::new(x, 0)).is_none());
    }
    assert_eq!(g.pool(Player::First).cats_in_hand, 3);
    assert_eq!(g.pool(Player::First).kittens_in_hand, 5);
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

    g.apply(Move {
        coord: Coord::new(2, 0),
        piece: PieceKind::Cat,
    })
    .unwrap();

    assert_eq!(g.winner(), Some(Player::First));
}
