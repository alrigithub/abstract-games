use std::time::{Duration, Instant};

use boop::{GameState, Move};
use minimax::{Evaluation, Evaluator, Game};

use crate::evaluator::{BoopEvaluator, Heuristic};
use crate::game::BoopGame;
use crate::heuristics::SimpleHeuristic;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SearchLimits {
    pub max_depth: u32,
    pub max_nodes: u64,
    pub time_budget_ms: u64,
}

impl SearchLimits {
    pub fn from_depth_only(max_depth: u32) -> Self {
        Self {
            max_depth,
            max_nodes: u64::MAX,
            time_budget_ms: 60_000,
        }
    }
}

impl Default for SearchLimits {
    fn default() -> Self {
        Self {
            max_depth: 4,
            max_nodes: 12_000,
            time_budget_ms: 1_200,
        }
    }
}

struct SearchState<'a, H: Heuristic> {
    eval: BoopEvaluator<'a, H>,
    deadline: Instant,
    max_nodes: u64,
    nodes: u64,
}

impl<'a, H: Heuristic> SearchState<'a, H> {
    fn timed_out(&self) -> bool {
        Instant::now() >= self.deadline || self.nodes >= self.max_nodes
    }

    fn evaluate_terminal(&self, state: &GameState) -> Evaluation {
        if let Some(winner) = BoopGame::get_winner(state) {
            return winner.evaluate();
        }
        self.eval.evaluate(state)
    }

    fn negamax(&mut self, state: &mut GameState, depth: u8, mut alpha: Evaluation, beta: Evaluation) -> Evaluation {
        self.nodes += 1;
        if self.timed_out() {
            return self.evaluate_terminal(state);
        }
        if let Some(winner) = BoopGame::get_winner(state) {
            return winner.evaluate();
        }
        if depth == 0 {
            return self.eval.evaluate(state);
        }

        let mut moves = Vec::new();
        BoopGame::generate_moves(state, &mut moves);
        if moves.is_empty() {
            return self.eval.evaluate(state);
        }

        let mut best = Evaluation::MIN / 2;
        for m in moves {
            if self.timed_out() {
                break;
            }
            let Some(mut child) = BoopGame::apply(state, m) else {
                continue;
            };
            let value = -self.negamax(&mut child, depth - 1, -beta, -alpha);
            if value > best {
                best = value;
            }
            if best > alpha {
                alpha = best;
            }
            if alpha >= beta {
                break;
            }
        }
        best
    }
}

/// Iterative deepening negamax with wall-clock and node budgets.
pub fn choose_move_limited(state: &GameState, limits: SearchLimits) -> Option<Move> {
    let legal = state.legal_moves();
    if legal.is_empty() {
        return None;
    }
    if legal.len() == 1 {
        return Some(legal[0]);
    }

    let max_depth = limits.max_depth.clamp(1, 10) as u8;
    let max_nodes = limits.max_nodes.max(1);
    let budget = Duration::from_millis(limits.time_budget_ms.clamp(50, 120_000));
    let deadline = Instant::now() + budget;

    let heuristic = SimpleHeuristic::new();
    let mut ctx = SearchState {
        eval: BoopEvaluator::new(&heuristic),
        deadline,
        max_nodes,
        nodes: 0,
    };

    let mut best = legal[0];
    for depth in 1..=max_depth {
        if ctx.timed_out() {
            break;
        }
        let mut moves = Vec::new();
        BoopGame::generate_moves(state, &mut moves);
        if moves.is_empty() {
            break;
        }

        let mut iteration_best = best;
        let mut alpha = Evaluation::MIN / 2;
        let beta = Evaluation::MAX / 2;
        let mut complete = true;

        for m in moves {
            if ctx.timed_out() {
                complete = false;
                break;
            }
            let Some(mut child) = BoopGame::apply(&mut state.clone(), m) else {
                continue;
            };
            let score = -ctx.negamax(&mut child, depth - 1, -beta, -alpha);
            if score > alpha {
                alpha = score;
                iteration_best = m;
            }
        }
        if complete {
            best = iteration_best;
        }
    }

    Some(best)
}

#[cfg(test)]
mod tests {
    use super::*;
    use boop::GameState;

    #[test]
    fn respects_tight_node_budget() {
        let g = GameState::new();
        let start = Instant::now();
        let mv = choose_move_limited(
            &g,
            SearchLimits {
                max_depth: 8,
                max_nodes: 500,
                time_budget_ms: 60_000,
            },
        )
        .expect("move");
        assert!(g.legal_moves().contains(&mv));
        assert!(start.elapsed() < Duration::from_secs(2));
    }
}
