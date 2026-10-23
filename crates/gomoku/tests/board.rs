use gomoku::{Coord, GameState, Move, Player};

#[test]
fn empty_board_no_winner() {
    let g = GameState::new();
    assert!(g.winner().is_none());
    assert_eq!(g.to_move(), Player::Black);
}

#[test]
fn five_in_a_row_horizontal_wins() {
    let mut g = GameState::new();
    // Black places (7,7),(8,7),(9,7),(10,7),(11,7) with White fillers elsewhere
    for x in 7..11 {
        g.apply(Move::Place(Coord::new(x, 7))).unwrap();
        g.apply(Move::Place(Coord::new(x, 8))).unwrap(); // White
    }
    g.apply(Move::Place(Coord::new(11, 7))).unwrap();
    assert_eq!(g.winner(), Some(Player::Black));
}

#[test]
fn reject_occupied_cell() {
    let mut g = GameState::new();
    g.apply(Move::Place(Coord::new(7, 7))).unwrap();
    assert!(g.apply(Move::Place(Coord::new(7, 7))).is_err());
}
