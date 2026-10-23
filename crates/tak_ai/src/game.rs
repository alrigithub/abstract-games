use minimax::{Game, Winner};
use tak::{BOARD_SIZE, Coord, GameState, Move};

pub struct TakGame;

impl Game for TakGame {
    type S = GameState;
    type M = Move;

    fn generate_moves(state: &Self::S, moves: &mut Vec<Self::M>) {
        moves.extend(ordered_moves(state));
    }

    fn apply(state: &mut Self::S, m: Self::M) -> Option<Self::S> {
        let mut new_state = state.clone();
        new_state.apply(m).ok()?;
        Some(new_state)
    }

    fn get_winner(state: &Self::S) -> Option<Winner> {
        match state.winner() {
            Some(p) if p == state.to_move() => Some(Winner::PlayerToMove),
            Some(_) => Some(Winner::PlayerJustMoved),
            None => None,
        }
    }
}

fn ordered_moves(state: &GameState) -> Vec<Move> {
    let mut moves = state.legal_moves();
    moves.sort_by_key(move_priority);
    moves.reverse();
    moves
}

fn move_priority(m: &Move) -> i16 {
    match m {
        Move::Place { coord, kind } => {
            center_priority(*coord)
                + match kind {
                    tak::StoneKind::Flat => 10,
                    tak::StoneKind::Wall => 5,
                    tak::StoneKind::Cap => 8,
                }
        }
        Move::Slide { from, .. } => center_priority(*from),
    }
}

fn center_priority(coord: Coord) -> i16 {
    let center = (BOARD_SIZE as f32 / 2.0 - 0.5) as i16;
    -((coord.x as i16 - center).abs() + (coord.y as i16 - center).abs())
}

pub fn possible_moves(state: &GameState) -> impl Iterator<Item = Move> + '_ {
    ordered_moves(state).into_iter()
}
