mod evaluator;
mod game;
mod heuristics;

pub use evaluator::Heuristic;
pub use game::{TakGame, possible_moves};
pub use heuristics::SimpleHeuristic;

use evaluator::TakEvaluator;
use minimax::{Negamax, Strategy};
use tak::{GameState, Move};

pub fn choose_move(state: &GameState, max_depth: u32) -> Option<Move> {
    let legal = state.legal_moves();
    if legal.is_empty() {
        return None;
    }
    if legal.len() == 1 {
        return Some(legal[0]);
    }

    let depth = max_depth.clamp(1, 8) as u8;
    let heuristic = SimpleHeuristic::new();
    let mut strategy = Negamax::new(TakEvaluator::new(&heuristic), depth);
    strategy.choose_move(state)
}
