use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use bevy::window::{CursorIcon, PrimaryWindow, SystemCursorIcon};
use bevy_tweening::{TweenAnim, TweenState, TweeningPlugin};
use tzaar::{Coord, Move, all_playable_coords};

use crate::{
    PLAYER_HUMAN,
    ai::AiSet,
    graphics::{FOREGROUND_RENDER_LAYER, MainCamera, ScaleFactor, ScaleFactorSet},
    pass_ui::{human_may_pass, submit_pass},
    piece_visual::{PieceDrawMaterials, spawn_stack_piece},
    state_update::{
        BoardResyncEvent, GameState, InteractionState, PlayerMoveEvent, StateUpdateSet,
    },
};

#[derive(Component)]
pub struct BoardElement {
    pub coord: Coord,
    pub layer: u8,
}

#[derive(Component)]
pub struct CursorElement;

#[derive(Resource, Default)]
pub struct CursorCoord(pub Option<Coord>);

#[derive(Resource, Default)]
pub struct SelectedStack(pub Option<Coord>);

fn viewport_to_coord(
    viewport_pos: Vec2,
    camera: &Camera,
    camera_transform: &GlobalTransform,
    scale_factor: &ScaleFactor,
) -> Option<Coord> {
    let world_pos = camera
        .viewport_to_world(camera_transform, viewport_pos)
        .map(|ray| ray.origin.truncate())
        .ok()?;

    let max_dist_sq = (scale_factor.spacing * 0.42 * scale_factor.factor).powi(2);

    all_playable_coords()
        .into_iter()
        .filter(|coord| {
            let screen_pos = scale_factor.screen_point(*coord).truncate();
            (screen_pos - world_pos).length_squared() <= max_dist_sq
        })
        .min_by(|a, b| {
            let da = (scale_factor.screen_point(*a).truncate() - world_pos).length_squared();
            let db = (scale_factor.screen_point(*b).truncate() - world_pos).length_squared();
            da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
        })
}

fn setup_cursor(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    materials: Res<PieceDrawMaterials>,
) {
    let piece = tzaar::Piece {
        player: PLAYER_HUMAN,
        kind: tzaar::PieceKind::Tott,
    };
    let entity = spawn_stack_piece(&mut commands, &mut meshes, &materials, piece, true, true);
    commands.entity(entity).insert((
        BoardElement {
            coord: Coord::new(0, 0),
            layer: 0,
        },
        CursorElement,
        Visibility::Hidden,
        FOREGROUND_RENDER_LAYER,
        Transform::default(),
    ));
}

fn spawn_stack_visual(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &PieceDrawMaterials,
    scale_factor: &ScaleFactor,
    coord: Coord,
    game_state: &GameState,
) {
    let Some(stack) = game_state.board().stack(coord) else {
        return;
    };
    let z_step = 5.0 * scale_factor.factor;
    let top_index = stack.pieces().len().saturating_sub(1);
    for (i, piece) in stack.pieces().iter().enumerate() {
        let is_top = i == top_index;
        let entity = spawn_stack_piece(commands, meshes, materials, *piece, is_top, false);
        let mut transform = Transform::from_translation(
            scale_factor.screen_point(coord) + Vec3::new(0., 0., i as f32 * z_step),
        );
        transform.scale = Vec3::splat(scale_factor.factor);
        commands.entity(entity).insert((
            BoardElement {
                coord,
                layer: i as u8,
            },
            FOREGROUND_RENDER_LAYER,
            transform,
        ));
    }
}

fn handle_resync(
    mut resync_events: MessageReader<BoardResyncEvent>,
    game_state: Res<GameState>,
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    materials: Res<PieceDrawMaterials>,
    scale_factor: Res<ScaleFactor>,
    q_pieces: Query<Entity, (With<BoardElement>, Without<CursorElement>)>,
) {
    for _ in resync_events.read() {
        for entity in q_pieces.iter() {
            commands.entity(entity).despawn();
        }
        for coord in all_playable_coords() {
            if game_state.board().stack(coord).is_some() {
                spawn_stack_visual(
                    &mut commands,
                    &mut meshes,
                    &materials,
                    &scale_factor,
                    coord,
                    &game_state,
                );
            }
        }
    }
}

fn startup_board(mut resync: MessageWriter<BoardResyncEvent>) {
    resync.write(BoardResyncEvent);
}

fn clear_animators(q: Query<(Entity, &TweenAnim)>, mut commands: Commands) {
    for (entity, animator) in q.iter() {
        if matches!(animator.tween_state(), TweenState::Completed) {
            commands.entity(entity).remove::<TweenAnim>();
        }
    }
}

fn move_board_elements(
    scale_factor: Res<ScaleFactor>,
    game_state: Res<GameState>,
    mut query: Query<(&BoardElement, &mut Transform), Without<TweenAnim>>,
) {
    for (element, mut transform) in query.iter_mut() {
        let base = scale_factor.screen_point(element.coord);
        let z_step = 4.0 * scale_factor.factor;
        transform.translation.x = base.x;
        transform.translation.y = base.y;
        transform.translation.z = base.z + element.layer as f32 * z_step;
    }
    let _ = &game_state;
}

fn scale_board_elements(
    scale_factor: Res<ScaleFactor>,
    mut query: Query<&mut Transform, (With<BoardElement>, Without<TweenAnim>)>,
) {
    for mut transform in query.iter_mut() {
        transform.scale = Vec3::splat(scale_factor.factor);
    }
}

fn legal_action_from(game_state: &GameState, from: Coord, to: Coord) -> Option<Move> {
    game_state
        .legal_moves()
        .into_iter()
        .find(|m| matches!(m, Move::Action { from: f, to: t } if *f == from && *t == to))
}

fn update_cursor(
    scale_factor: Res<ScaleFactor>,
    q_window: Query<&Window, With<PrimaryWindow>>,
    q_camera: Query<(&Camera, &GlobalTransform), With<MainCamera>>,
    interaction_state: Res<InteractionState>,
    game_state: Res<GameState>,
    selected: Res<SelectedStack>,
    mut cursor_coord: ResMut<CursorCoord>,
    mut cursor: Query<(&mut BoardElement, &mut Visibility, &mut Transform), With<CursorElement>>,
) {
    let Ok(window) = q_window.single() else {
        return;
    };
    let Ok((camera, camera_transform)) = q_camera.single() else {
        return;
    };

    cursor_coord.0 = window
        .cursor_position()
        .and_then(|pos| viewport_to_coord(pos, camera, camera_transform, &scale_factor));

    let Ok((mut element, mut visibility, mut transform)) = cursor.single_mut() else {
        return;
    };

    if !matches!(*interaction_state, InteractionState::HumanTurn) {
        *visibility = Visibility::Hidden;
        return;
    }

    if let (Some(from), Some(to)) = (selected.0, cursor_coord.0)
        && legal_action_from(&game_state, from, to).is_some()
    {
        *visibility = Visibility::Visible;
        element.coord = to;
        transform.translation = scale_factor.screen_point(to);
        transform.scale = Vec3::splat(scale_factor.factor);
        return;
    }

    *visibility = Visibility::Hidden;
}

fn handle_clicks(
    mouse: Res<ButtonInput<MouseButton>>,
    interaction_state: Res<InteractionState>,
    cursor_coord: Res<CursorCoord>,
    game_state: Res<GameState>,
    mut selected: ResMut<SelectedStack>,
    mut player_move_events: MessageWriter<PlayerMoveEvent>,
) {
    if !mouse.just_pressed(MouseButton::Left) {
        return;
    }
    if !matches!(*interaction_state, InteractionState::HumanTurn) {
        return;
    }
    let Some(coord) = cursor_coord.0 else {
        return;
    };

    if human_may_pass(&game_state, &interaction_state)
        && selected.0.is_none()
        && game_state.board().stack(coord).is_none()
    {
        submit_pass(&mut player_move_events);
        return;
    }

    if let Some(from) = selected.0 {
        if from == coord {
            selected.0 = None;
            return;
        }
        if let Some(m) = legal_action_from(&game_state, from, coord) {
            player_move_events.write(PlayerMoveEvent(PLAYER_HUMAN, m));
            selected.0 = None;
            return;
        }
    }

    if game_state
        .board()
        .stack(coord)
        .is_some_and(|s| s.owner() == PLAYER_HUMAN)
    {
        selected.0 = Some(coord);
    }
}

fn handle_pass_input(
    keyboard: Res<ButtonInput<KeyCode>>,
    mouse: Res<ButtonInput<MouseButton>>,
    interaction_state: Res<InteractionState>,
    game_state: Res<GameState>,
    mut player_move_events: MessageWriter<PlayerMoveEvent>,
) {
    if !human_may_pass(&game_state, &interaction_state) {
        return;
    }

    let pass_key = keyboard.just_pressed(KeyCode::KeyP)
        || keyboard.just_pressed(KeyCode::Space)
        || keyboard.just_pressed(KeyCode::Enter);

    if pass_key || mouse.just_pressed(MouseButton::Right) {
        submit_pass(&mut player_move_events);
    }
}

fn set_cursor_icon(
    interaction_state: Res<InteractionState>,
    q_window: Query<Entity, With<PrimaryWindow>>,
    mut commands: Commands,
) {
    let Ok(window) = q_window.single() else {
        return;
    };
    let icon = if matches!(*interaction_state, InteractionState::HumanTurn) {
        CursorIcon::System(SystemCursorIcon::Pointer)
    } else {
        CursorIcon::System(SystemCursorIcon::Progress)
    };
    commands.entity(window).insert(icon);
}

pub fn plugin(app: &mut App) {
    app.init_resource::<CursorCoord>()
        .init_resource::<SelectedStack>()
        .add_plugins(TweeningPlugin)
        .add_systems(Startup, (setup_cursor, startup_board))
        .add_systems(
            Update,
            (
                handle_resync.after(StateUpdateSet),
                clear_animators,
                move_board_elements.after(ScaleFactorSet),
                scale_board_elements.after(ScaleFactorSet),
                update_cursor.after(ScaleFactorSet),
                handle_clicks.before(StateUpdateSet).ambiguous_with(AiSet),
                handle_pass_input
                    .before(StateUpdateSet)
                    .ambiguous_with(AiSet),
                set_cursor_icon,
            ),
        );
}
