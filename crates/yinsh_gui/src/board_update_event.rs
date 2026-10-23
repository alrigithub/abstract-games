use bevy::prelude::Message;

use yinsh::{Coord, Player};

#[derive(Message)]
pub enum BoardUpdateEvent {
    AddRing(Coord, Player),
    AddMarker(Coord, Player),
    MoveRing(Coord, Coord),
    /// Scoring ring removal: tween to the side rack instead of despawning.
    RemoveRingToRack(Coord, Player, usize),
    RemoveRun(Vec<Coord>),
    FlipMarkers(Coord, Coord, Vec<Coord>),
}
