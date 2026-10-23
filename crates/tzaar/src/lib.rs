mod board;
mod coord;
mod game_state;
mod piece;
mod player;

pub use board::{Board, Stack, TEMPLATE, all_playable_coords, is_playable};
pub use coord::{Coord, DIRECTIONS, step};
pub use game_state::{GameState, IllegalMove, TurnPhase};
pub use piece::{Piece, PieceKind};
pub use player::Player;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Move {
    /// Move a stack from `from` to `to` (capture or reinforce depending on phase).
    Action { from: Coord, to: Coord },
    /// Skip the optional second sub-move of a turn.
    PassSecond,
}
