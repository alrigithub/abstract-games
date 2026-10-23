#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Player {
    First,
    Second,
}

impl Player {
    pub fn opponent(self) -> Self {
        match self {
            Player::First => Player::Second,
            Player::Second => Player::First,
        }
    }
}
