use std::task::Poll;

use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use bevy_async_task::TaskRunner;
use tak::{GameState, Move, Player};

use crate::graphics::ANIMATION_DURATION;
use crate::state_update::{PlayerMoveEvent, StateUpdateSet};

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct AiSet;

#[derive(Resource)]
pub struct AiPlayerStrength(pub u32);

#[derive(Message)]
pub enum AiComputationEvent {
    Start(Player, Box<GameState>),
    #[allow(unused)]
    Cancel,
}

fn perform_ai_moves(
    mut task_runner: TaskRunner<Option<(Player, Move)>>,
    mut events: MessageReader<AiComputationEvent>,
    strength: Res<AiPlayerStrength>,
    mut player_move_events: MessageWriter<PlayerMoveEvent>,
) {
    for event in events.read() {
        match event {
            AiComputationEvent::Start(player, game_state) => {
                let player = *player;
                let game_state = game_state.clone();
                let search_depth = strength.0;
                task_runner.start(async move {
                    #[cfg(not(target_arch = "wasm32"))]
                    std::thread::sleep(ANIMATION_DURATION);

                    #[cfg(target_arch = "wasm32")]
                    gloo_timers::future::TimeoutFuture::new(ANIMATION_DURATION.as_millis() as u32)
                        .await;

                    tak_ai::choose_move(&game_state, search_depth).map(|m| (player, m))
                });
            }
            AiComputationEvent::Cancel => {
                task_runner.start(async move { None });
            }
        }
    }

    match task_runner.poll() {
        Poll::Pending | Poll::Ready(None) => {}
        Poll::Ready(Some((player, player_move))) => {
            player_move_events.write(PlayerMoveEvent(player, player_move));
        }
    }
}

pub fn plugin(app: &mut App) {
    #[cfg(target_arch = "wasm32")]
    let default_strength = 3u32;
    #[cfg(not(target_arch = "wasm32"))]
    let default_strength = if cfg!(debug_assertions) { 3 } else { 5 };

    app.insert_resource(AiPlayerStrength(default_strength))
        .add_message::<AiComputationEvent>()
        .add_systems(Update, perform_ai_moves.in_set(AiSet).after(StateUpdateSet));
}
