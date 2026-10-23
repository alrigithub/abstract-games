use std::time::{Duration, Instant};
use tzaar::{GameState, Move, TurnPhase};

#[test]
fn choose_move_completes_quickly_for_many_plies() {
    let mut g = GameState::new();
    for ply in 0..50 {
        if g.winner().is_some() {
            break;
        }
        let start = Instant::now();
        let m = tzaar_ai::choose_move(&g, 3).expect("move");
        assert!(start.elapsed() < Duration::from_secs(3), "ply {ply} slow");
        assert!(g.legal_moves().contains(&m));
        g.apply(m).unwrap();
        if g.phase() == TurnPhase::OptionalSecond {
            g.apply(Move::PassSecond).unwrap();
        }
    }
}
