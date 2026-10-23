#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Player {
    /// White — moves first (opening capture only, then full turns).
    First,
    /// Black.
    Second,
}

impl Player {
    pub fn opponent(self) -> Self {
        match self {
            Self::First => Self::Second,
            Self::Second => Self::First,
        }
    }
}
