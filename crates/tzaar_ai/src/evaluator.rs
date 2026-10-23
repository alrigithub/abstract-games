use minimax::{Evaluation, Evaluator};
use tzaar::{GameState, Player};

use super::game::TzaarGame;

pub trait Heuristic {
    fn identifier(&self) -> String;
    fn evaluate_for_first(&self, state: &GameState) -> Evaluation;
}

pub struct TzaarEvaluator<'a, H: Heuristic> {
    heuristic: &'a H,
}

impl<'a, H: Heuristic> TzaarEvaluator<'a, H> {
    pub fn new(heuristic: &'a H) -> Self {
        Self { heuristic }
    }
}

impl<'a, H: Heuristic> Evaluator for TzaarEvaluator<'a, H> {
    type G = TzaarGame;

    fn evaluate(&self, state: &GameState) -> Evaluation {
        if state.winner() == Some(Player::First) {
            return Evaluation::MAX / 2;
        }
        if state.winner() == Some(Player::Second) {
            return Evaluation::MIN / 2;
        }

        let score = self.heuristic.evaluate_for_first(state);

        match state.to_move() {
            Player::First => score,
            Player::Second => -score,
        }
    }
}
