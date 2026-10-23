use crate::Player;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PieceKind {
    Tzaar,
    Tzarra,
    Tott,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Piece {
    pub player: Player,
    pub kind: PieceKind,
}
