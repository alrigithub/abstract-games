use crate::coord::Coord;
use crate::piece::Piece;
use crate::BOARD_SIZE;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Board {
    cells: [[Option<Piece>; BOARD_SIZE]; BOARD_SIZE],
}

impl Board {
    pub fn empty() -> Self {
        Self {
            cells: [[None; BOARD_SIZE]; BOARD_SIZE],
        }
    }

    pub fn get(&self, coord: Coord) -> Option<Piece> {
        self.cells[coord.y as usize][coord.x as usize]
    }

    pub fn set(&mut self, coord: Coord, piece: Piece) {
        self.cells[coord.y as usize][coord.x as usize] = Some(piece);
    }

    pub fn clear(&mut self, coord: Coord) {
        self.cells[coord.y as usize][coord.x as usize] = None;
    }

    pub fn is_empty(&self, coord: Coord) -> bool {
        self.get(coord).is_none()
    }

    pub fn empty_coords(&self) -> impl Iterator<Item = Coord> + '_ {
        (0..BOARD_SIZE as u8).flat_map(move |y| {
            (0..BOARD_SIZE as u8).filter_map(move |x| {
                let coord = Coord { x, y };
                if self.is_empty(coord) {
                    Some(coord)
                } else {
                    None
                }
            })
        })
    }

    pub fn count_pieces(&self, player: crate::player::Player) -> u32 {
        self.cells
            .iter()
            .flatten()
            .filter(|cell| cell.is_some_and(|p| p.player == player))
            .count() as u32
    }

    pub fn count_cats(&self, player: crate::player::Player) -> u32 {
        self.cells
            .iter()
            .flatten()
            .filter(|cell| {
                cell.is_some_and(|p| p.player == player && p.kind == crate::piece::PieceKind::Cat)
            })
            .count() as u32
    }
}
