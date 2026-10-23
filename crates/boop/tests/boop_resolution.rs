use boop::{Coord, GameState, Move, Piece, PieceKind, Player};

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
