use crate::coord::{Coord, DIRECTIONS, step};
use crate::piece::{Piece, PieceKind};
use crate::player::Player;

/// Template from the official fixed start (Waltz thesis): `100` = hole or outside.
pub const TEMPLATE: [i8; 81] = [
    -1, 1, 1, 1, 1, 100, 100, 100, 100, -1, -2, 2, 2, 2, -1, 100, 100, 100, -1, -2, -3, 3, 3,
    -2, -1, 100, 100, -1, -2, -3, -1, 1, -3, -2, -1, 100, 1, 2, 3, 1, 100, -1, -3, -2, -1, 100,
    1, 2, 3, -1, 1, 3, 2, 1, 100, 100, 1, 2, -3, -3, 3, 2, 1, 100, 100, 100, 1, -2, -2, -2, 2, 1,
    100, 100, 100, 100, -1, -1, -1, -1, 1,
];

pub const GRID_WIDTH: i8 = 9;
pub const GRID_HEIGHT: i8 = 9;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Stack {
    pieces: Vec<Piece>,
}

impl Stack {
    pub fn singleton(piece: Piece) -> Self {
        Self {
            pieces: vec![piece],
        }
    }

    pub fn from_pieces(pieces: Vec<Piece>) -> Self {
        Self { pieces }
    }

    pub fn height(&self) -> u8 {
        self.pieces.len() as u8
    }

    pub fn owner(&self) -> Player {
        self.pieces[0].player
    }

    pub fn top(&self) -> Piece {
        *self.pieces.last().expect("non-empty stack")
    }

    pub fn pieces(&self) -> &[Piece] {
        &self.pieces
    }

    pub fn merge_on_top(&mut self, other: Stack) {
        debug_assert_eq!(self.owner(), other.owner());
        self.pieces.extend(other.pieces);
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Board {
    stacks: [Option<Stack>; 81],
}

impl Default for Board {
    fn default() -> Self {
        Self {
            stacks: std::array::from_fn(|_| None),
        }
    }
}

pub fn is_playable(coord: Coord) -> bool {
    coord
        .index()
        .is_some_and(|i| TEMPLATE[i] != 100)
}

pub fn all_playable_coords() -> Vec<Coord> {
    let mut coords = Vec::with_capacity(60);
    for y in 0..GRID_HEIGHT {
        for x in 0..GRID_WIDTH {
            let coord = Coord::new(x, y);
            if is_playable(coord) {
                coords.push(coord);
            }
        }
    }
    coords
}

fn template_piece(value: i8) -> Piece {
    let (player, kind) = match value.abs() {
        1 => (
            if value > 0 {
                Player::First
            } else {
                Player::Second
            },
            PieceKind::Tott,
        ),
        2 => (
            if value > 0 {
                Player::First
            } else {
                Player::Second
            },
            PieceKind::Tzarra,
        ),
        3 => (
            if value > 0 {
                Player::First
            } else {
                Player::Second
            },
            PieceKind::Tzaar,
        ),
        _ => panic!("invalid template cell {value}"),
    };
    Piece { player, kind }
}

impl Board {
    pub fn fixed_start() -> Self {
        let mut board = Self::default();
        for coord in all_playable_coords() {
            let idx = coord.index().expect("playable");
            let value = TEMPLATE[idx];
            debug_assert_ne!(value, 100);
            board.stacks[idx] = Some(Stack::singleton(template_piece(value)));
        }
        board
    }

    pub fn stack(&self, coord: Coord) -> Option<&Stack> {
        coord.index().and_then(|i| self.stacks[i].as_ref())
    }

    pub fn stack_mut(&mut self, coord: Coord) -> Option<&mut Stack> {
        coord.index().and_then(|i| self.stacks[i].as_mut())
    }

    pub fn is_empty(&self, coord: Coord) -> bool {
        self.stack(coord).is_none()
    }

    pub fn remove_stack(&mut self, coord: Coord) -> Option<Stack> {
        coord.index().and_then(|i| self.stacks[i].take())
    }

    pub fn set_stack(&mut self, coord: Coord, stack: Stack) {
        let idx = coord.index().expect("playable");
        self.stacks[idx] = Some(stack);
    }

    pub fn slide_target(&self, from: Coord, direction: (i8, i8)) -> Option<Coord> {
        if !is_playable(from) || self.is_empty(from) {
            return None;
        }
        let mut current = from;
        loop {
            let next = step(current, direction);
            if !is_playable(next) {
                return None;
            }
            if !self.is_empty(next) {
                return Some(next);
            }
            current = next;
        }
    }

    pub fn capture_targets(&self, from: Coord, player: Player) -> Vec<Coord> {
        let Some(attacker) = self.stack(from) else {
            return Vec::new();
        };
        if attacker.owner() != player {
            return Vec::new();
        }
        let height = attacker.height();
        let mut targets = Vec::new();
        for dir in DIRECTIONS {
            let Some(to) = self.slide_target(from, dir) else {
                continue;
            };
            let Some(defender) = self.stack(to) else {
                continue;
            };
            if defender.owner() != player.opponent() {
                continue;
            }
            if height >= defender.height() {
                targets.push(to);
            }
        }
        targets
    }

    pub fn stack_targets(&self, from: Coord, player: Player) -> Vec<Coord> {
        let Some(attacker) = self.stack(from) else {
            return Vec::new();
        };
        if attacker.owner() != player {
            return Vec::new();
        }
        let mut targets = Vec::new();
        for dir in DIRECTIONS {
            let Some(to) = self.slide_target(from, dir) else {
                continue;
            };
            let Some(target) = self.stack(to) else {
                continue;
            };
            if target.owner() == player {
                targets.push(to);
            }
        }
        targets
    }

    pub fn visible_types(&self, player: Player) -> [bool; 3] {
        let mut present = [false; 3];
        for coord in all_playable_coords() {
            let Some(stack) = self.stack(coord) else {
                continue;
            };
            if stack.owner() != player {
                continue;
            }
            present[kind_index(stack.top().kind)] = true;
        }
        present
    }
}

fn kind_index(kind: PieceKind) -> usize {
    match kind {
        PieceKind::Tzaar => 0,
        PieceKind::Tzarra => 1,
        PieceKind::Tott => 2,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn playable_cell_count() {
        assert_eq!(all_playable_coords().len(), 60);
    }
}
