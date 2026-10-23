use boop::{BOARD_SIZE, Coord, GameState, Move, PieceKind, TurnMode};
use minimax::{Game, Winner};

pub struct BoopGame;

impl Game for BoopGame {
    type S = GameState;
    type M = Move;

    fn generate_moves(state: &Self::S, moves: &mut Vec<Self::M>) {
        moves.extend(ordered_moves(state));
    }

    /// Apply a move and, if the placement left a graduation choice pending, resolve it
    /// greedily so that consecutive search plies always alternate players (negamax assumes
    /// this). The root-level choice is still searched properly via `legal_moves`.
    fn apply(state: &mut Self::S, m: Self::M) -> Option<Self::S> {
        let mut new_state = state.clone();
        new_state.apply(m).ok()?;
        if let Some(line) = greedy_graduation_choice(&new_state) {
            new_state.apply(Move::Graduate { line }).ok()?;
        }
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

/// Prefer the candidate line that graduates the most kittens (cats only return to the pool).
pub fn greedy_graduation_choice(state: &GameState) -> Option<[Coord; 3]> {
    let TurnMode::ChooseGraduation(lines) = state.turn_mode() else {
        return None;
    };
    lines.into_iter().max_by_key(|line| {
        line.iter()
            .filter(|coord| {
                state
                    .board()
                    .get(**coord)
                    .is_some_and(|p| p.kind == PieceKind::Kitten)
            })
            .count()
    })
}

fn ordered_moves(state: &GameState) -> Vec<Move> {
    let mut moves = state.legal_moves();
    moves.sort_by_key(|m| center_priority(m.coord()));
    moves.reverse();
    moves
}

fn center_priority(coord: Coord) -> i16 {
    let center = (BOARD_SIZE as f32 / 2.0 - 0.5) as i16;
    -((coord.x as i16 - center).abs() + (coord.y as i16 - center).abs())
}

pub fn possible_moves(state: &GameState) -> impl Iterator<Item = Move> + '_ {
    ordered_moves(state).into_iter()
}
