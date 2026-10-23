use gomoku::{GameState, Move};
use gomoku_ai::choose_move;

#[test]
fn chooses_legal_opening_move() {
    let g = GameState::new();
    let m = choose_move(&g, 2).expect("move");
    assert!(matches!(m, Move::Place(_)));
    let mut g2 = g.clone();
    assert!(g2.apply(m).is_ok());
}
