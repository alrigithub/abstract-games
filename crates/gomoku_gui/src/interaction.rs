use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use bevy::window::{CursorIcon, PrimaryWindow, SystemCursorIcon};
use bevy_tweening::{
    EaseMethod, Tween, TweenAnim, TweenState, TweeningPlugin, lens::TransformScaleLens,
};
use gomoku::{Coord, Move, Player, BOARD_SIZE};

use crate::{
    PLAYER_HUMAN,
    ai::AiSet,
    graphics::{
        ANIMATION_DURATION, FOREGROUND_RENDER_LAYER, MainCamera, PlayerColors, ScaleFactor,
        ScaleFactorSet, stone_mesh,
    },
    state_update::{
        BoardUpdateEvent, GameState, InteractionState, PlayerMoveEvent, StateUpdateSet,
    },
};

#[derive(Component)]
pub struct BoardElement(pub Coord, #[allow(dead_code)] pub Player);

#[derive(Component)]
pub struct Stone;

#[derive(Component)]
pub struct CursorElement;

#[derive(Resource, Default)]
pub struct CursorCoord(pub Option<Coord>);

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

    let max_dist_sq = (scale_factor.spacing * 0.45).powi(2);

    (0..BOARD_SIZE as u8)
        .flat_map(|y| (0..BOARD_SIZE as u8).map(move |x| Coord { x, y }))
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

fn setup_cursor_stone(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    player_colors: Res<PlayerColors>,
) {
    commands.spawn((
        stone_mesh(
            &mut meshes,
            player_colors.human_ghost.clone(),
            Visibility::Hidden,
        ),
        BoardElement(Coord::new(0, 0), PLAYER_HUMAN),
        Stone,
        CursorElement,
        FOREGROUND_RENDER_LAYER,
    ));
}

fn spawn_stone(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    player_colors: &PlayerColors,
    scale_factor: &ScaleFactor,
    coord: Coord,
    player: Player,
) {
    let color = if player == PLAYER_HUMAN {
        player_colors.human.clone()
    } else {
        player_colors.ai.clone()
    };

    let mut entity = commands.spawn((
        stone_mesh(meshes, color, Visibility::Visible),
        BoardElement(coord, player),
        Stone,
        FOREGROUND_RENDER_LAYER,
        Transform::from_translation(scale_factor.screen_point(coord))
            .with_scale(Vec3::splat(0.01 * scale_factor.factor)),
    ));

    let tween = Tween::new(
        EaseMethod::default(),
        ANIMATION_DURATION,
        TransformScaleLens {
            start: Vec3::splat(0.01 * scale_factor.factor),
            end: Vec3::splat(scale_factor.factor),
        },
    );
    entity.insert(TweenAnim::new(tween));
}

fn update_board_elements(
    mut board_update_events: MessageReader<BoardUpdateEvent>,
    mut commands: Commands,
    scale_factor: Res<ScaleFactor>,
    mut meshes: ResMut<Assets<Mesh>>,
    player_colors: Res<PlayerColors>,
) {
    for event in board_update_events.read() {
        let BoardUpdateEvent::AddStone(coord, player) = *event;
        spawn_stone(
            &mut commands,
            &mut meshes,
            &player_colors,
            &scale_factor,
            coord,
            player,
        );
    }
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
    mut query: Query<(&BoardElement, &mut Transform), Without<TweenAnim>>,
) {
    for (BoardElement(coord, _), mut transform) in query.iter_mut() {
        transform.translation = scale_factor.screen_point(*coord);
    }
}

fn scale_board_elements(
    scale_factor: Res<ScaleFactor>,
    mut query: Query<&mut Transform, (With<BoardElement>, Without<TweenAnim>)>,
) {
    for mut transform in query.iter_mut() {
        transform.scale = Vec3::splat(scale_factor.factor);
    }
}

#[allow(clippy::type_complexity)]
fn update_cursor(
    scale_factor: Res<ScaleFactor>,
    mut q_window: Query<&mut Window, With<PrimaryWindow>>,
    q_camera: Query<(&Camera, &GlobalTransform), With<MainCamera>>,
    interaction_state: Res<InteractionState>,
    game_state: Res<GameState>,
    mut cursor_coord: ResMut<CursorCoord>,
    mut cursor: Query<
        (&mut BoardElement, &mut Visibility, &mut Transform),
        (With<Stone>, With<CursorElement>),
    >,
) {
    let Ok(window) = q_window.single_mut() else {
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

    if !matches!(*interaction_state, InteractionState::HumanPlace) {
        *visibility = Visibility::Hidden;
        return;
    }

    if let Some(coord) = cursor_coord.0
        && game_state.board.get(coord).is_none()
    {
        *visibility = Visibility::Visible;
        element.0 = coord;
        transform.translation = scale_factor.screen_point(coord);
        transform.scale = Vec3::splat(scale_factor.factor);
        return;
    }

    *visibility = Visibility::Hidden;
}

fn handle_clicks(
    mouse: Res<ButtonInput<MouseButton>>,
    interaction_state: Res<InteractionState>,
    cursor_coord: Res<CursorCoord>,
    mut player_move_events: MessageWriter<PlayerMoveEvent>,
) {
    if !mouse.just_pressed(MouseButton::Left) {
        return;
    }
    if !matches!(*interaction_state, InteractionState::HumanPlace) {
        return;
    }
    let Some(coord) = cursor_coord.0 else {
        return;
    };
    player_move_events.write(PlayerMoveEvent(PLAYER_HUMAN, Move::Place(coord)));
}

fn set_cursor_icon(
    interaction_state: Res<InteractionState>,
    q_window: Query<Entity, With<PrimaryWindow>>,
    mut commands: Commands,
) {
    let Ok(window) = q_window.single() else {
        return;
    };
    let icon = if matches!(*interaction_state, InteractionState::HumanPlace) {
        CursorIcon::System(SystemCursorIcon::Pointer)
    } else {
        CursorIcon::System(SystemCursorIcon::Progress)
    };
    commands.entity(window).insert(icon);
}

pub fn plugin(app: &mut App) {
    app.init_resource::<CursorCoord>()
        .add_plugins(TweeningPlugin)
        .add_systems(Startup, setup_cursor_stone)
        .add_systems(
            Update,
            (
                update_board_elements
                    .after(StateUpdateSet)
                    .before(clear_animators),
                clear_animators,
                move_board_elements.after(ScaleFactorSet),
                scale_board_elements.after(ScaleFactorSet),
                update_cursor.after(ScaleFactorSet),
                handle_clicks.before(StateUpdateSet).ambiguous_with(AiSet),
                set_cursor_icon,
            ),
        );
}
