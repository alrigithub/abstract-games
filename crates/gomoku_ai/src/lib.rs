mod evaluator;
mod game;
mod heuristics;

pub use evaluator::Heuristic;
pub use game::{GomokuGame, possible_moves};
pub use heuristics::SimpleHeuristic;

use evaluator::GomokuEvaluator;
use gomoku::{GameState, Move};
use minimax::{Negamax, Strategy};

pub fn choose_move(state: &GameState, max_depth: u32) -> Option<Move> {
    let legal = state.legal_moves();
    if legal.is_empty() {
        return None;
    }
    if legal.len() == 1 {
        return Some(legal[0]);
    }

    let depth = max_depth.clamp(1, 12) as u8;
    let heuristic = SimpleHeuristic::default();
    let mut strategy = Negamax::new(GomokuEvaluator::new(&heuristic), depth);
    strategy.choose_move(state)
}
