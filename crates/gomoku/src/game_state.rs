use crate::board::Board;
use crate::coord::Coord;
use crate::player::Player;
use crate::Move;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IllegalMove;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameState {
    pub board: Board,
    pub to_move: Player,
    pub winner: Option<Player>,
    pub move_count: u32,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            board: Board::empty(),
            to_move: Player::Black,
            winner: None,
            move_count: 0,
        }
    }

    pub fn to_move(&self) -> Player {
        self.to_move
    }

    pub fn winner(&self) -> Option<Player> {
        self.winner
    }

    pub fn apply(&mut self, player_move: Move) -> Result<(), IllegalMove> {
        if self.winner.is_some() {
            return Err(IllegalMove);
        }

        let Move::Place(coord) = player_move;

        if Coord::try_new(coord.x, coord.y).is_none() {
            return Err(IllegalMove);
        }
        if self.board.get(coord).is_some() {
            return Err(IllegalMove);
        }

        let player = self.to_move;
        self.board.set(coord, player);
        self.move_count += 1;

        if let Some(winner) = self.board.winner_from_last_move(coord) {
            self.winner = Some(winner);
        } else if self.board.is_full() {
            // Draw: no winner remains None
        } else {
            self.to_move = player.opponent();
        }

        Ok(())
    }

    pub fn legal_moves(&self) -> Vec<Move> {
        if self.winner.is_some() || self.board.is_full() {
            return Vec::new();
        }
        self.board
            .empty_coords()
            .map(Move::Place)
            .collect()
    }
}

impl Default for GameState {
    fn default() -> Self {
        Self::new()
    }
}
