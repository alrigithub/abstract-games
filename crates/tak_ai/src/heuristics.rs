use minimax::Evaluation;
use tak::{BOARD_SIZE, Coord, GameState, Player, StoneKind};

use crate::evaluator::Heuristic;

#[derive(Debug, Clone, Copy, Default)]
pub struct SimpleHeuristic {
    pub f_flat: Evaluation,
    pub f_cap: Evaluation,
    pub f_reserve: Evaluation,
    pub f_center: Evaluation,
}

impl SimpleHeuristic {
    pub fn new() -> Self {
        Self {
            f_flat: 25,
            f_cap: 80,
            f_reserve: 15,
            f_center: 5,
        }
    }
}

impl Heuristic for SimpleHeuristic {
    fn evaluate_for_first(&self, state: &GameState) -> Evaluation {
        let first = material(state, Player::First);
        let second = material(state, Player::Second);

        self.f_flat * (first.flats - second.flats)
            + self.f_cap * (first.caps - second.caps)
            + self.f_reserve * (first.reserve_flats - second.reserve_flats)
            + self.f_center * (first.center - second.center)
            + road_bonus(state, Player::First)
            - road_bonus(state, Player::Second)
    }

    fn identifier(&self) -> String {
        "simple".into()
    }
}

struct Material {
    flats: Evaluation,
    caps: Evaluation,
    reserve_flats: Evaluation,
    center: Evaluation,
}

fn material(state: &GameState, player: Player) -> Material {
    let reserve = state.reserve(player);
    let center = (BOARD_SIZE as f32 / 2.0 - 0.5) as i16;
    let mut flats = 0i32;
    let mut caps = 0i32;
    let mut center_score = 0i32;

    for y in 0..BOARD_SIZE as u8 {
        for x in 0..BOARD_SIZE as u8 {
            let coord = Coord { x, y };
            let Some(top) = state.board().top(coord) else {
                continue;
            };
            if top.owner != player {
                continue;
            }
            center_score += (center
                - ((coord.x as i16 - center).abs() + (coord.y as i16 - center).abs()))
                as i32;
            match top.kind {
                StoneKind::Flat | StoneKind::Wall => flats += 1,
                StoneKind::Cap => caps += 1,
            }
        }
    }

    Material {
        flats: flats as Evaluation,
        caps: caps as Evaluation,
        reserve_flats: reserve.flats as Evaluation,
        center: center_score as Evaluation,
    }
}

fn road_bonus(state: &GameState, player: Player) -> Evaluation {
    let mut bonus = 0i32;
    let size = BOARD_SIZE as u8;
    for x in 0..size {
        if road_cell(state, Coord { x, y: 0 }, player) {
            bonus += 3;
        }
        if road_cell(state, Coord { x, y: size - 1 }, player) {
            bonus += 3;
        }
    }
    for y in 0..size {
        if road_cell(state, Coord { x: 0, y }, player) {
            bonus += 3;
        }
        if road_cell(state, Coord { x: size - 1, y }, player) {
            bonus += 3;
        }
    }
    bonus as Evaluation
}

fn road_cell(state: &GameState, coord: Coord, player: Player) -> bool {
    state
        .board()
        .top(coord)
        .is_some_and(|s| s.owner == player && s.counts_for_road())
}
