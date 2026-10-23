use std::time::{Duration, Instant};

use tzaar::{GameState, Move, Player, TurnPhase};

/// Reproduces GUI flow: human forced capture, pass optional second, AI must reply.
#[test]
fn ai_move_after_human_capture_and_pass() {
    let mut g = GameState::new();
    // White opening
    g.apply(g.legal_moves()[0]).unwrap();
    assert_eq!(g.to_move(), Player::Second);

    // Black (AI) full turn: forced + pass
    g.apply(g.legal_moves()[0]).unwrap();
    g.apply(Move::PassSecond).unwrap();
    assert_eq!(g.to_move(), Player::First);

    // Human forced capture + pass (the reported playtest path)
    g.apply(g.legal_moves()[0]).unwrap();
    assert_eq!(g.phase(), TurnPhase::OptionalSecond);
    g.apply(Move::PassSecond).unwrap();
    assert_eq!(g.to_move(), Player::Second);
    assert_eq!(g.phase(), TurnPhase::ForcedCapture);
    assert!(g.winner().is_none());

    let state = g.clone();
    let start = Instant::now();
    let ai_move = tzaar_ai::choose_move(&state, 3).expect("AI should choose a forced capture");
    assert!(
        start.elapsed() < Duration::from_secs(5),
        "depth-3 search took {:?}",
        start.elapsed()
    );
    assert!(state.legal_moves().contains(&ai_move));

    let mut after = state.clone();
    after.apply(ai_move).unwrap();
    assert_eq!(after.to_move(), Player::Second);
    assert_eq!(after.phase(), TurnPhase::OptionalSecond);

    // Second AI sub-move should also be legal
    let ai_second = tzaar_ai::choose_move(&after, 3).expect("AI optional second");
    assert!(after.legal_moves().contains(&ai_second));
}
