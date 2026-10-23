use tak::{Coord, GameState, Move, StoneKind};
use tak_ai::{choose_move, possible_moves};

#[test]
fn legal_moves_non_empty_on_fresh_game() {
    let state = GameState::new();
    assert!(!state.legal_moves().is_empty());
    assert_eq!(possible_moves(&state).count(), state.legal_moves().len());
}

#[test]
fn choose_move_returns_legal_placement() {
    let state = GameState::new();
    let m = choose_move(&state, 2).expect("expected a move");
    assert!(state.legal_moves().contains(&m));
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

#[test]
fn place_move_roundtrip() {
    let state = GameState::new();
    let m = Move::Place {
        coord: Coord::new(2, 2),
        kind: StoneKind::Flat,
    };
    let mut next = state.clone();
    next.apply(m).unwrap();
    let chosen = choose_move(&state, 1).unwrap();
    assert!(matches!(chosen, Move::Place { .. }));
}
