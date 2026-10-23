use bevy::ecs::message::MessageReader;
use bevy::prelude::*;
#[cfg(not(target_arch = "wasm32"))]
use bevy_async_task::TaskRunner;
#[cfg(not(target_arch = "wasm32"))]
use std::task::Poll;

#[cfg(not(target_arch = "wasm32"))]
use yinsh::Move;
use yinsh::{GameState, Player, TurnMode};

use crate::graphics::ANIMATION_DURATION;
use crate::state_update::{MoveApplicationSet, PendingAiMove};

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct AiSet;

#[derive(Resource)]
pub struct AiPlayerStrength(pub usize);

#[derive(Message)]
pub enum AiComputationEvent {
    Start(Player, GameState),

    #[allow(unused)]
    Cancel,
}

#[cfg(target_arch = "wasm32")]
#[derive(Resource, Default)]
struct WasmAiComputation {
    delay: Option<Timer>,
    player: Option<Player>,
    state: Option<GameState>,
}

#[cfg(target_arch = "wasm32")]
fn perform_ai_moves(
    time: Res<Time>,
    mut work: ResMut<WasmAiComputation>,
    mut events: MessageReader<AiComputationEvent>,
    strength: Res<AiPlayerStrength>,
    mut pending_ai_move: ResMut<PendingAiMove>,
) {
    for event in events.read() {
        match event {
            AiComputationEvent::Start(player, game_state) => {
                let needs_delay = matches!(game_state.turn_mode, TurnMode::MarkerPlacement);
                if needs_delay {
                    work.player = Some(*player);
                    work.state = Some(game_state.clone());
                    work.delay = Some(Timer::new(ANIMATION_DURATION, TimerMode::Once));
                } else {
                    let player_move = yinsh_ai::get_ai_move(strength.0, &game_state);
                    pending_ai_move.0 = Some((*player, player_move));
                }
            }
            AiComputationEvent::Cancel => {
                *work = WasmAiComputation::default();
                pending_ai_move.0 = None;
            }
        }
    }

    let Some(timer) = work.delay.as_mut() else {
        return;
    };
    timer.tick(time.delta());
    if !timer.is_finished() {
        return;
    }

    let Some(player) = work.player.take() else {
        work.delay = None;
        return;
    };
    let Some(game_state) = work.state.take() else {
        work.delay = None;
        return;
    };
    work.delay = None;

    let player_move = yinsh_ai::get_ai_move(strength.0, &game_state);
    pending_ai_move.0 = Some((player, player_move));
}

#[cfg(not(target_arch = "wasm32"))]
fn perform_ai_moves(
    mut task_runner: TaskRunner<Option<(Player, Move)>>,
    mut events: MessageReader<AiComputationEvent>,
    strength: Res<AiPlayerStrength>,
    mut pending_ai_move: ResMut<PendingAiMove>,
) {
    for event in events.read() {
        match event {
            AiComputationEvent::Start(player, game_state) => {
                let player = *player;
                let game_state = game_state.clone();
                let search_depth = strength.0;
                task_runner.start(async move {
                    // Make sure the AI takes at least as long as the animation
                    if matches!(game_state.turn_mode, TurnMode::MarkerPlacement) {
                        std::thread::sleep(ANIMATION_DURATION);
                    }

                    Some((player, yinsh_ai::get_ai_move(search_depth, &game_state)))
                });
            }
            AiComputationEvent::Cancel => {
                task_runner.start(async move { None });
                pending_ai_move.0 = None;
            }
        }
    }

    match task_runner.poll() {
        Poll::Pending => {}
        Poll::Ready(None) => {}
        Poll::Ready(Some((player, player_move))) => {
            pending_ai_move.0 = Some((player, player_move));
        }
    }
}

pub fn plugin(app: &mut App) {
    #[cfg(target_arch = "wasm32")]
    let default_strength = 10;
    #[cfg(not(target_arch = "wasm32"))]
    let default_strength = if cfg!(debug_assertions) { 6 } else { 12 };

    app.insert_resource(AiPlayerStrength(default_strength))
        .add_message::<AiComputationEvent>();

    #[cfg(target_arch = "wasm32")]
    app.init_resource::<WasmAiComputation>();

    app.add_systems(
        Update,
        perform_ai_moves.in_set(AiSet).after(MoveApplicationSet),
    );
}
