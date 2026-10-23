use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use bevy::window::{CursorIcon, PrimaryWindow, SystemCursorIcon};
use tzaar::{Coord, Move, all_playable_coords};

use crate::{
    PLAYER_HUMAN,
    ai::AiSet,
    board_entity::{BoardElement, CursorElement, StackHeightLabel},
    graphics::{
        FOREGROUND_RENDER_LAYER, MainCamera, PIECE_RADIUS_FRAC, ScaleFactor, ScaleFactorSet,
    },
    pass_ui::{human_may_pass, submit_pass},
    piece_visual::{
        INK, MARK_ON_DARK, PIECE_RADIUS, PieceDrawMaterials, PieceMeshes, spawn_stack_piece_at,
    },
    state_update::{
        BoardResyncEvent, GameState, InteractionState, PlayerMoveEvent, StateUpdateSet,
    },
};

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

    let max_dist_sq = (scale_factor.world_spacing() * (PIECE_RADIUS_FRAC + 0.02)).powi(2);

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
    piece_meshes: Res<PieceMeshes>,
    materials: Res<PieceDrawMaterials>,
) {
    let piece = tzaar::Piece {
        player: PLAYER_HUMAN,
        kind: tzaar::PieceKind::Tott,
    };
    spawn_stack_piece_at(
        &mut commands,
        &piece_meshes,
        &materials,
        piece,
        true,
        Transform::default(),
        BoardElement {
            coord: Coord::new(0, 0),
            layer: 0,
        },
        true,
    );
}

fn spawn_stack_visual(
    commands: &mut Commands,
    piece_meshes: &PieceMeshes,
    materials: &PieceDrawMaterials,
    scale_factor: &ScaleFactor,
    coord: Coord,
    game_state: &GameState,
) {
    let Some(stack) = game_state.board().stack(coord) else {
        return;
    };
    let mut transform = Transform::from_translation(scale_factor.screen_point(coord));
    transform.scale = Vec3::splat(scale_factor.factor);
    spawn_stack_piece_at(
        commands,
        piece_meshes,
        materials,
        stack.top(),
        false,
        transform,
        BoardElement { coord, layer: 0 },
        false,
    );

    let height = stack.height();
    if height > 1 {
        let label_color = match stack.top().player {
            tzaar::Player::Second => MARK_ON_DARK,
            tzaar::Player::First => INK,
        };
        let mut label_tf = transform;
        label_tf.translation.y -= PIECE_RADIUS * scale_factor.factor * 0.08;
        label_tf.translation.z += 1.0;
        commands.spawn((
            Text2d::new(height.to_string()),
            TextFont {
                font_size: 13.0,
                ..default()
            },
            TextColor(label_color),
            label_tf,
            BoardElement { coord, layer: 1 },
            StackHeightLabel,
            FOREGROUND_RENDER_LAYER,
        ));
    }
}

fn handle_resync(
    mut resync_events: MessageReader<BoardResyncEvent>,
    game_state: Res<GameState>,
    mut commands: Commands,
    piece_meshes: Res<PieceMeshes>,
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
                    &piece_meshes,
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

fn move_board_elements(
    scale_factor: Res<ScaleFactor>,
    mut query: Query<(&BoardElement, &mut Transform), Without<StackHeightLabel>>,
) {
    for (element, mut transform) in query.iter_mut() {
        let base = scale_factor.screen_point(element.coord);
        transform.translation.x = base.x;
        transform.translation.y = base.y;
        transform.translation.z = base.z + element.layer as f32;
    }
}

fn move_stack_labels(
    scale_factor: Res<ScaleFactor>,
    mut query: Query<(&BoardElement, &mut Transform), With<StackHeightLabel>>,
) {
    for (element, mut transform) in query.iter_mut() {
        let base = scale_factor.screen_point(element.coord);
        transform.translation.x = base.x;
        transform.translation.y = base.y - PIECE_RADIUS * scale_factor.factor * 0.08;
        transform.translation.z = base.z + 1.0;
    }
}

fn scale_board_elements(
    scale_factor: Res<ScaleFactor>,
    mut query: Query<&mut Transform, With<BoardElement>>,
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

    let show = matches!(*interaction_state, InteractionState::HumanTurn)
        && selected
            .0
            .and_then(|from| cursor_coord.0.map(|to| (from, to)))
            .is_some_and(|(from, to)| legal_action_from(&game_state, from, to).is_some());

    for (mut element, mut visibility, mut transform) in cursor.iter_mut() {
        if show {
            let to = cursor_coord.0.expect("show implies coord");
            *visibility = Visibility::Visible;
            element.coord = to;
            transform.translation = scale_factor.screen_point(to);
            transform.scale = Vec3::splat(scale_factor.factor);
        } else {
            *visibility = Visibility::Hidden;
        }
    }
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
        .add_systems(Startup, (setup_cursor, startup_board))
        .add_systems(
            Update,
            (
                handle_resync.after(StateUpdateSet),
                move_board_elements.after(ScaleFactorSet),
                move_stack_labels.after(ScaleFactorSet),
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
