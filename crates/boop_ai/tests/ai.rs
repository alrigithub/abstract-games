use boop::{Coord, GameState, Move, Piece, PieceKind, Player, Pool, TurnMode};
use boop_ai::{choose_move, BoopGame};
use minimax::Game;

#[test]
fn chooses_legal_opening_move() {
    let g = GameState::new();
    let m = choose_move(&g, 2).expect("move");
    let mut g2 = g.clone();
    assert!(g2.apply(m).is_ok());
    assert!(matches!(
        m,
        Move::Place {
            piece: PieceKind::Kitten,
            ..
        }
    ));
}

/// Two kittens in a row and two in a column; placing at the corner completes both lines.
fn two_line_setup(player: Player) -> GameState {
    let mut g = GameState::new();
    let kitten = Piece {
        player,
        kind: PieceKind::Kitten,
    };
    g.set_piece(Coord::new(0, 0), kitten);
    g.set_piece(Coord::new(1, 0), kitten);
    g.set_piece(Coord::new(2, 1), kitten);
    g.set_piece(Coord::new(2, 2), kitten);
    g.set_to_move(player);
    g.set_pool(
        player,
        Pool {
            kittens_in_hand: 4,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );
    g
}

#[test]
fn search_tree_folds_pending_graduation_so_players_alternate() {
    let g = two_line_setup(Player::Second);
    let placed = BoopGame::apply(
        &mut g.clone(),
        Move::Place {
            coord: Coord::new(2, 0),
            piece: PieceKind::Kitten,
        },
    )
    .expect("legal");

    assert_eq!(placed.turn_mode(), TurnMode::Place);
    assert_eq!(placed.to_move(), Player::First);
    assert_eq!(placed.pool(Player::Second).cats_in_hand, 3);
}

#[test]
fn chooses_a_legal_graduation_line_when_choice_is_pending() {
    let mut g = two_line_setup(Player::Second);
    g.apply(Move::Place {
        coord: Coord::new(2, 0),
        piece: PieceKind::Kitten,
    })
    .unwrap();
    assert!(matches!(g.turn_mode(), TurnMode::ChooseGraduation(_)));

    let m = choose_move(&g, 3).expect("move");
    assert!(matches!(m, Move::Graduate { .. }));
    assert!(g.legal_moves().contains(&m));
    g.apply(m).unwrap();
    assert_eq!(g.to_move(), Player::First);
}

#[test]
fn search_tree_folds_same_turn_alternate_graduation() {
    let coords = [(0, 0), (2, 0), (4, 0), (0, 2), (2, 2), (4, 2), (0, 4)];
    let mut g = GameState::new();
    for (x, y) in coords {
        g.set_piece(
            Coord::new(x, y),
            Piece {
                player: Player::Second,
                kind: PieceKind::Kitten,
            },
        );
    }
    g.set_to_move(Player::Second);
    g.set_pool(
        Player::Second,
        Pool {
            kittens_in_hand: 1,
            cats_in_hand: 0,
            cats_in_reserve: 8,
        },
    );

    let placed = BoopGame::apply(
        &mut g.clone(),
        Move::Place {
            coord: Coord::new(4, 4),
            piece: PieceKind::Kitten,
        },
    )
    .expect("legal");

    assert_eq!(placed.turn_mode(), TurnMode::Place);
    assert_eq!(placed.to_move(), Player::First);
    assert_eq!(placed.board().count_pieces(Player::Second), 7);
    assert_eq!(placed.pool(Player::Second).cats_in_hand, 1);
}

#[test]
fn ai_picks_single_available_alternate_graduation_move() {
    let mut g = GameState::new();
    let cat = Piece {
        player: Player::Second,
        kind: PieceKind::Cat,
    };
    let kitten = Piece {
        player: Player::Second,
        kind: PieceKind::Kitten,
    };
    for (i, coord) in [
        (0, 0),
        (2, 0),
        (4, 0),
        (0, 2),
        (2, 2),
        (4, 2),
        (0, 4),
        (5, 5),
    ]
    .into_iter()
    .enumerate()
    {
        g.set_piece(
            Coord::new(coord.0, coord.1),
            if i == 7 { kitten } else { cat },
        );
    }
    g.set_to_move(Player::Second);
    g.set_pool(
        Player::Second,
        Pool {
            kittens_in_hand: 0,
            cats_in_hand: 0,
            cats_in_reserve: 1,
        },
    );

    let m = choose_move(&g, 3).expect("move");
    assert!(g.legal_moves().contains(&m));
}
