mod bounded;
mod evaluator;
mod game;
mod heuristics;

pub use bounded::{choose_move_limited, SearchLimits};
pub use evaluator::Heuristic;
pub use game::{possible_moves, BoopGame};
pub use heuristics::SimpleHeuristic;

use boop::{GameState, Move};

pub fn choose_move(state: &GameState, max_depth: u32) -> Option<Move> {
    choose_move_limited(state, SearchLimits::from_depth_only(max_depth))
}
