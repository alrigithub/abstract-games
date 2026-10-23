#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Player {
    First,
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
