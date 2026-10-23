use bevy::prelude::*;
use tzaar::Coord;

#[derive(Component, Clone, Copy)]
pub struct BoardElement {
    pub coord: Coord,
    pub layer: u8,
}

#[derive(Component)]
pub struct CursorElement;

#[derive(Component)]
pub struct StackHeightLabel;
