use crate::coord::Coord;
use crate::piece::Piece;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PieceDisplacement {
    pub from: Coord,
    pub to: Coord,
    pub piece: Piece,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OffBoardExit {
    pub from: Coord,
    pub piece: Piece,
    /// Grid direction the piece was pushed (same axis as the boop).
    pub push: (i8, i8),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineHighlight {
    Graduation([Coord; 3]),
    Win([Coord; 3]),
    EightCatsOnBed,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MoveEffects {
    /// Single-step boop pushes from the piece just placed (no chains).
    pub displacements: Vec<PieceDisplacement>,
    pub off_board: Vec<OffBoardExit>,
    pub line_highlight: Option<LineHighlight>,
    /// Cells cleared by automatic graduation this turn (always three when present).
    pub graduated_cells: Option<[Coord; 3]>,
}
