use minimax::Evaluation;
use tzaar::{GameState, PieceKind, Player, TurnPhase, all_playable_coords};

use crate::evaluator::Heuristic;

#[derive(Debug, Clone, Copy, Default)]
pub struct SimpleHeuristic {
    pub f_piece: Evaluation,
    pub f_height: Evaluation,
    pub f_type: Evaluation,
}

impl SimpleHeuristic {
    pub fn new() -> Self {
        Self {
            f_piece: 8,
            f_height: 12,
            f_type: 40,
        }
    }
}

impl Heuristic for SimpleHeuristic {
    fn evaluate_for_first(&self, state: &GameState) -> Evaluation {
        let first = material(state, Player::First);
        let second = material(state, Player::Second);

        self.f_piece * (first.pieces - second.pieces)
            + self.f_height * (first.stack_height - second.stack_height)
            + self.f_type * (first.type_score - second.type_score)
            + phase_bonus(state, Player::First)
            - phase_bonus(state, Player::Second)
    }

    fn identifier(&self) -> String {
        "simple".into()
    }
}

struct Material {
    pieces: Evaluation,
    stack_height: Evaluation,
    type_score: Evaluation,
}

fn material(state: &GameState, player: Player) -> Material {
    let mut pieces = 0i32;
    let mut stack_height = 0i32;
    for coord in all_playable_coords() {
        let Some(stack) = state.board().stack(coord) else {
            continue;
        };
        if stack.owner() != player {
            continue;
        }
        stack_height += stack.height() as i32;
        pieces += stack.pieces().len() as i32;
    }

    let visible = state.board().visible_types(player);
    let type_score = visible
        .iter()
        .enumerate()
        .map(|(i, present)| {
            if *present {
                match i {
                    0 => 3, // Tzaar
                    1 => 2, // Tzarra
                    _ => 1,
                }
            } else {
                -20
            }
        })
        .sum::<i32>();

    Material {
        pieces: pieces as Evaluation,
        stack_height: stack_height as Evaluation,
        type_score: type_score as Evaluation,
    }
}

fn phase_bonus(state: &GameState, player: Player) -> Evaluation {
    if state.to_move() != player {
        return 0;
    }
    match state.phase() {
        TurnPhase::OptionalSecond => 5,
        TurnPhase::ForcedCapture => {
            if state.legal_moves().is_empty() {
                -500
            } else {
                2
            }
        }
        TurnPhase::WhiteOpening => 0,
    }
}

#[allow(dead_code)]
fn kind_weight(kind: PieceKind) -> i32 {
    match kind {
        PieceKind::Tzaar => 3,
        PieceKind::Tzarra => 2,
        PieceKind::Tott => 1,
    }
}
