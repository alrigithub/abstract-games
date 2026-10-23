use crate::Player;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum StoneKind {
    Flat,
    Wall,
    Cap,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Stone {
    pub owner: Player,
    pub kind: StoneKind,
}

impl Stone {
    pub fn counts_for_road(self) -> bool {
        matches!(self.kind, StoneKind::Flat | StoneKind::Cap)
    }

    pub fn blocks_stack_on_top(self) -> bool {
        matches!(self.kind, StoneKind::Wall | StoneKind::Cap)
    }
}
