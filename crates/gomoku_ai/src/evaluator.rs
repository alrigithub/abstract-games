use gomoku::{GameState, Player};
use minimax::{Evaluation, Evaluator};

use super::game::GomokuGame;

pub trait Heuristic {
    fn identifier(&self) -> String;

    fn evaluate_for_black(&self, state: &GameState) -> Evaluation;
}

pub struct GomokuEvaluator<'a, H: Heuristic> {
    heuristic: &'a H,
}

impl<'a, H: Heuristic> GomokuEvaluator<'a, H> {
    pub fn new(heuristic: &'a H) -> Self {
        Self { heuristic }
    }
}

impl<'a, H: Heuristic> Evaluator for GomokuEvaluator<'a, H> {
    type G = GomokuGame;

    fn evaluate(&self, state: &GameState) -> Evaluation {
        if state.winner() == Some(Player::Black) {
            return Evaluation::MAX / 2;
        }
        if state.winner() == Some(Player::White) {
            return Evaluation::MIN / 2;
        }

        let score = self.heuristic.evaluate_for_black(state);

        match state.to_move() {
            Player::Black => score,
            Player::White => -score,
        }
    }
}
