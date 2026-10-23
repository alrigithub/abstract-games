use gomoku::{Board, Coord, GameState, Move, Player, BOARD_SIZE};
use minimax::{Game, Winner};

/// Stateless rules adapter for the `minimax` crate.
pub struct GomokuGame;

impl Game for GomokuGame {
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
    moves.sort_by_key(|m| {
        let Move::Place(coord) = m;
        center_priority(*coord)
    });
    moves.reverse();
    moves
}

fn center_priority(coord: Coord) -> i16 {
    let center = (BOARD_SIZE / 2) as i16;
    -((coord.x as i16 - center).abs() + (coord.y as i16 - center).abs())
}

pub fn possible_moves(state: &GameState) -> impl Iterator<Item = Move> + '_ {
    ordered_moves(state).into_iter()
}

pub fn player_stones(board: &Board, player: Player) -> u32 {
    (0..BOARD_SIZE as u8)
        .flat_map(|y| (0..BOARD_SIZE as u8).map(move |x| Coord { x, y }))
        .filter(|coord| board.get(*coord) == Some(player))
        .count() as u32
}
