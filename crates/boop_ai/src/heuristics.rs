use boop::{Coord, GameState, PieceKind, Player, BOARD_SIZE};
use minimax::Evaluation;

use crate::evaluator::Heuristic;

#[derive(Debug, Clone, Copy, Default)]
pub struct SimpleHeuristic {
    pub f_kitten: Evaluation,
    pub f_cat: Evaluation,
    pub f_cat_in_hand: Evaluation,
    pub f_center: Evaluation,
}

impl SimpleHeuristic {
    pub fn new() -> Self {
        Self {
            f_kitten: 20,
            f_cat: 120,
            f_cat_in_hand: 80,
            f_center: 4,
        }
    }
}

impl Heuristic for SimpleHeuristic {
    fn evaluate_for_first(&self, state: &GameState) -> Evaluation {
        let first = material(state, Player::First);
        let second = material(state, Player::Second);

        self.f_kitten * (first.kittens - second.kittens)
            + self.f_cat * (first.cats - second.cats)
            + self.f_cat_in_hand * (first.cats_in_hand - second.cats_in_hand)
            + self.f_center * (first.center - second.center)
    }

    fn identifier(&self) -> String {
        "simple".into()
    }
}

struct Material {
    kittens: Evaluation,
    cats: Evaluation,
    cats_in_hand: Evaluation,
    center: Evaluation,
}

fn material(state: &GameState, player: Player) -> Material {
    let pool = state.pool(player);
    let center = (BOARD_SIZE as f32 / 2.0 - 0.5) as i16;
    let mut kittens = 0i32;
    let mut cats = 0i32;
    let mut center_score = 0i32;

    for y in 0..BOARD_SIZE as u8 {
        for x in 0..BOARD_SIZE as u8 {
            let coord = Coord { x, y };
            let Some(piece) = state.board().get(coord) else {
                continue;
            };
            if piece.player != player {
                continue;
            }
            center_score += (center
                - ((coord.x as i16 - center).abs() + (coord.y as i16 - center).abs()))
                as i32;
            match piece.kind {
                PieceKind::Kitten => kittens += 1,
                PieceKind::Cat => cats += 1,
            }
        }
    }

    Material {
        kittens: kittens as Evaluation,
        cats: cats as Evaluation,
        cats_in_hand: pool.cats_in_hand as Evaluation,
        center: center_score as Evaluation,
    }
}
