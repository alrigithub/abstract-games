use crate::board::Board;
use crate::coord::{Coord, DIRECTIONS, step};
use crate::piece::PieceKind;
use crate::player::Player;
use crate::Move;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IllegalMove;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TurnPhase {
    /// White's first move: one adjacent capture only (official opening).
    WhiteOpening,
    /// First sub-move of a turn: forced capture along a line.
    ForcedCapture,
    /// Second sub-move: optional capture, stack, or pass.
    OptionalSecond,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameState {
    board: Board,
    to_move: Player,
    phase: TurnPhase,
    winner: Option<Player>,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            board: Board::fixed_start(),
            to_move: Player::First,
            phase: TurnPhase::WhiteOpening,
            winner: None,
        }
    }

    pub fn board(&self) -> &Board {
        &self.board
    }

    #[doc(hidden)]
    pub fn board_mut(&mut self) -> &mut Board {
        &mut self.board
    }

    pub fn to_move(&self) -> Player {
        self.to_move
    }

    pub fn phase(&self) -> TurnPhase {
        self.phase
    }

    pub fn winner(&self) -> Option<Player> {
        self.winner
    }

    #[doc(hidden)]
    pub fn set_board(&mut self, board: Board) {
        self.board = board;
    }

    #[doc(hidden)]
    pub fn set_to_move(&mut self, player: Player) {
        self.to_move = player;
    }

    #[doc(hidden)]
    pub fn set_phase(&mut self, phase: TurnPhase) {
        self.phase = phase;
    }

    pub fn legal_moves(&self) -> Vec<Move> {
        if self.winner.is_some() {
            return Vec::new();
        }

        match self.phase {
            TurnPhase::WhiteOpening => self.opening_captures(),
            TurnPhase::ForcedCapture => self.forced_captures(),
            TurnPhase::OptionalSecond => self.optional_second_moves(),
        }
    }

    fn opening_captures(&self) -> Vec<Move> {
        debug_assert_eq!(self.to_move, Player::First);
        let mut moves = Vec::new();
        for from in self.occupied(Player::First) {
            for to in self.board.capture_targets(from, Player::First) {
                if is_adjacent(from, to) {
                    moves.push(Move::Action { from, to });
                }
            }
        }
        moves
    }

    fn forced_captures(&self) -> Vec<Move> {
        let player = self.to_move;
        let mut moves = Vec::new();
        for from in self.occupied(player) {
            for to in self.board.capture_targets(from, player) {
                moves.push(Move::Action { from, to });
            }
        }
        moves
    }

    fn optional_second_moves(&self) -> Vec<Move> {
        let player = self.to_move;
        let mut moves = Vec::new();
        for from in self.occupied(player) {
            for to in self.board.capture_targets(from, player) {
                moves.push(Move::Action { from, to });
            }
            for to in self.board.stack_targets(from, player) {
                moves.push(Move::Action { from, to });
            }
        }
        moves.push(Move::PassSecond);
        moves
    }

    fn occupied(&self, player: Player) -> Vec<Coord> {
        crate::board::all_playable_coords()
            .into_iter()
            .filter(|coord| {
                self.board
                    .stack(*coord)
                    .is_some_and(|s| s.owner() == player)
            })
            .collect()
    }

    pub fn apply(&mut self, player_move: Move) -> Result<(), IllegalMove> {
        if self.winner.is_some() {
            return Err(IllegalMove);
        }

        match (self.phase, player_move) {
            (TurnPhase::WhiteOpening, Move::Action { from, to }) => {
                if self.to_move != Player::First {
                    return Err(IllegalMove);
                }
                if !is_adjacent(from, to) {
                    return Err(IllegalMove);
                }
                self.apply_capture(from, to, Player::First)?;
                self.check_type_win();
                if self.winner.is_none() {
                    self.to_move = Player::Second;
                    self.phase = TurnPhase::ForcedCapture;
                    self.check_no_capture_loss();
                }
                Ok(())
            }
            (TurnPhase::ForcedCapture, Move::Action { from, to }) => {
                let player = self.to_move;
                if !self.is_legal_capture(from, to, player) {
                    return Err(IllegalMove);
                }
                self.apply_capture(from, to, player)?;
                self.check_type_win();
                if self.winner.is_none() {
                    self.phase = TurnPhase::OptionalSecond;
                }
                Ok(())
            }
            (TurnPhase::OptionalSecond, Move::PassSecond) => {
                self.end_turn();
                Ok(())
            }
            (TurnPhase::OptionalSecond, Move::Action { from, to }) => {
                let player = self.to_move;
                if self.is_legal_capture(from, to, player) {
                    self.apply_capture(from, to, player)?;
                } else if self.is_legal_stack(from, to, player) {
                    self.apply_stack(from, to)?;
                } else {
                    return Err(IllegalMove);
                }
                self.check_type_win();
                if self.winner.is_none() {
                    self.end_turn();
                }
                Ok(())
            }
            _ => Err(IllegalMove),
        }
    }

    fn is_legal_capture(&self, from: Coord, to: Coord, player: Player) -> bool {
        self.board.capture_targets(from, player).contains(&to)
    }

    fn is_legal_stack(&self, from: Coord, to: Coord, player: Player) -> bool {
        self.board.stack_targets(from, player).contains(&to)
    }

    fn apply_capture(&mut self, from: Coord, to: Coord, player: Player) -> Result<(), IllegalMove> {
        if !self.is_legal_capture(from, to, player) {
            return Err(IllegalMove);
        }
        let moving = self
            .board
            .remove_stack(from)
            .ok_or(IllegalMove)?;
        if moving.owner() != player {
            self.board.set_stack(from, moving);
            return Err(IllegalMove);
        }
        let _ = self.board.remove_stack(to).ok_or(IllegalMove)?;
        self.board.set_stack(to, moving);
        Ok(())
    }

    fn apply_stack(&mut self, from: Coord, to: Coord) -> Result<(), IllegalMove> {
        let player = self
            .board
            .stack(from)
            .ok_or(IllegalMove)?
            .owner();
        if !self.is_legal_stack(from, to, player) {
            return Err(IllegalMove);
        }
        let moving = self.board.remove_stack(from).ok_or(IllegalMove)?;
        let target = self.board.stack_mut(to).ok_or(IllegalMove)?;
        target.merge_on_top(moving);
        Ok(())
    }

    fn end_turn(&mut self) {
        self.to_move = self.to_move.opponent();
        self.phase = TurnPhase::ForcedCapture;
        self.check_no_capture_loss();
    }

    fn check_type_win(&mut self) {
        for player in [Player::First, Player::Second] {
            let types = self.board.visible_types(player);
            if types.iter().any(|present| !present) {
                self.winner = Some(player.opponent());
                return;
            }
        }
    }

    fn check_no_capture_loss(&mut self) {
        if self.winner.is_some() {
            return;
        }
        if self.phase != TurnPhase::ForcedCapture {
            return;
        }
        if self.forced_captures().is_empty() {
            self.winner = Some(self.to_move.opponent());
        }
    }

    pub fn piece_counts_on_board(&self, player: Player) -> (u8, u8, u8) {
        let mut tzaar = 0u8;
        let mut tzarra = 0u8;
        let mut tott = 0u8;
        for coord in crate::board::all_playable_coords() {
            let Some(stack) = self.board.stack(coord) else {
                continue;
            };
            if stack.owner() != player {
                continue;
            }
            for piece in stack.pieces() {
                match piece.kind {
                    PieceKind::Tzaar => tzaar += 1,
                    PieceKind::Tzarra => tzarra += 1,
                    PieceKind::Tott => tott += 1,
                }
            }
        }
        (tzaar, tzarra, tott)
    }
}

fn is_adjacent(a: Coord, b: Coord) -> bool {
    DIRECTIONS.iter().any(|dir| step(a, *dir) == b)
}

impl Default for GameState {
    fn default() -> Self {
        Self::new()
    }
}
