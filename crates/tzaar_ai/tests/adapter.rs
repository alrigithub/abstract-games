use tzaar::{GameState, Move};
use tzaar_ai::{choose_move, possible_moves};

#[test]
fn legal_moves_non_empty_on_fresh_game() {
    let state = GameState::new();
    assert!(!state.legal_moves().is_empty());
    assert_eq!(possible_moves(&state).count(), state.legal_moves().len());
}

#[test]
fn choose_move_returns_legal_opening() {
    let state = GameState::new();
    let m = choose_move(&state, 2).expect("expected a move");
    assert!(state.legal_moves().contains(&m));
    assert!(matches!(m, Move::Action { .. }));
}

#[test]
fn choose_move_after_plies() {
    let mut state = GameState::new();
    for _ in 0..4 {
        let m = choose_move(&state, 2).expect("move");
        state.apply(m).unwrap();
    }
    let next = choose_move(&state, 2).expect("move after plies");
    assert!(state.legal_moves().contains(&next));
}
