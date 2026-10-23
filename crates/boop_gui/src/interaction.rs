use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use bevy::window::{CursorIcon, PrimaryWindow, SystemCursorIcon};
use bevy_tweening::{
    EaseMethod, Tween, TweenAnim, TweenState, TweeningPlugin, lens::TransformPositionLens,
    lens::TransformScaleLens,
};
use boop::{Coord, Move, Piece, PieceKind, BOARD_SIZE};

use crate::{
    PLAYER_HUMAN,
    ai::AiSet,
    graphics::{
        ANIMATION_DURATION, FOREGROUND_RENDER_LAYER, MainCamera, PieceMaterials, ScaleFactor,
        ScaleFactorSet, material_for, piece_mesh,
    },
    state_update::{
        BoardResyncEvent, BoardUpdateEvent, GameState, InteractionState, PlayerMoveEvent,
        HumanPieceChoice, StateUpdateSet,
    },
};

#[derive(Component)]
pub struct BoardElement {
    pub coord: Coord,
    pub piece: Piece,
}

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

fn setup_cursor(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    materials: Res<PieceMaterials>,
) {
    let ghost = Piece {
        player: PLAYER_HUMAN,
        kind: PieceKind::Kitten,
    };
    commands.spawn((
        piece_mesh(
            &mut meshes,
            materials.first_ghost.clone(),
            PieceKind::Kitten,
            Visibility::Hidden,
        ),
        BoardElement {
            coord: Coord::new(0, 0),
            piece: ghost,
        },
        CursorElement,
        FOREGROUND_RENDER_LAYER,
    ));
}

fn spawn_piece(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &PieceMaterials,
    scale_factor: &ScaleFactor,
    coord: Coord,
    piece: Piece,
    animate_scale: bool,
) {
    let material = material_for(materials, piece);
    let mut entity = commands.spawn((
        piece_mesh(
            meshes,
            material,
            piece.kind,
            Visibility::Visible,
        ),
        BoardElement { coord, piece },
        FOREGROUND_RENDER_LAYER,
        Transform::from_translation(scale_factor.screen_point(coord))
            .with_scale(Vec3::splat(if animate_scale {
                0.01 * scale_factor.factor
            } else {
                scale_factor.factor
            })),
    ));

    if animate_scale {
        entity.insert(TweenAnim::new(Tween::new(
            EaseMethod::default(),
            ANIMATION_DURATION,
            TransformScaleLens {
                start: Vec3::splat(0.01 * scale_factor.factor),
                end: Vec3::splat(scale_factor.factor),
            },
        )));
    }
}

fn handle_board_updates(
    mut board_update_events: MessageReader<BoardUpdateEvent>,
    mut commands: Commands,
    scale_factor: Res<ScaleFactor>,
    mut meshes: ResMut<Assets<Mesh>>,
    materials: Res<PieceMaterials>,
    mut q_pieces: Query<(Entity, &mut BoardElement, &mut Transform), Without<CursorElement>>,
) {
    for event in board_update_events.read() {
        match *event {
            BoardUpdateEvent::Spawn { coord, piece } => {
                spawn_piece(
                    &mut commands,
                    &mut meshes,
                    &materials,
                    &scale_factor,
                    coord,
                    piece,
                    true,
                );
            }
            BoardUpdateEvent::Move { from, to, piece } => {
                if let Some((entity, mut element, mut transform)) = q_pieces
                    .iter_mut()
                    .find(|(_, element, _)| element.coord == from && element.piece == piece)
                {
                    element.coord = to;
                    element.piece = piece;
                    let tween = Tween::new(
                        EaseMethod::default(),
                        ANIMATION_DURATION,
                        TransformPositionLens {
                            start: scale_factor.screen_point(from),
                            end: scale_factor.screen_point(to),
                        },
                    );
                    commands.entity(entity).insert(TweenAnim::new(tween));
                    transform.scale = Vec3::splat(scale_factor.factor);
                } else {
                    spawn_piece(
                        &mut commands,
                        &mut meshes,
                        &materials,
                        &scale_factor,
                        to,
                        piece,
                        false,
                    );
                }
            }
            BoardUpdateEvent::Remove { coord } => {
                for (entity, element, _) in q_pieces.iter() {
                    if element.coord == coord {
                        commands.entity(entity).despawn();
                        break;
                    }
                }
            }
        }
    }
}

fn handle_resync(
    mut resync_events: MessageReader<BoardResyncEvent>,
    game_state: Res<GameState>,
    mut board_update_events: MessageWriter<BoardUpdateEvent>,
) {
    for _ in resync_events.read() {
        for y in 0..BOARD_SIZE as u8 {
            for x in 0..BOARD_SIZE as u8 {
                let coord = Coord { x, y };
                if let Some(piece) = game_state.board().get(coord) {
                    board_update_events.write(BoardUpdateEvent::Spawn { coord, piece });
                }
            }
        }
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
    for (element, mut transform) in query.iter_mut() {
        transform.translation = scale_factor.screen_point(element.coord);
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

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
fn update_cursor(
    scale_factor: Res<ScaleFactor>,
    q_window: Query<&Window, With<PrimaryWindow>>,
    q_camera: Query<(&Camera, &GlobalTransform), With<MainCamera>>,
    interaction_state: Res<InteractionState>,
    game_state: Res<GameState>,
    selected_piece: Res<HumanPieceChoice>,
    mut cursor_coord: ResMut<CursorCoord>,
    materials: Res<PieceMaterials>,
    mut cursor: Query<
        (
            &mut BoardElement,
            &mut Visibility,
            &mut Transform,
            &mut MeshMaterial2d<ColorMaterial>,
        ),
        With<CursorElement>,
    >,
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

    let Ok((mut element, mut visibility, mut transform, mut material)) = cursor.single_mut() else {
        return;
    };

    if !matches!(*interaction_state, InteractionState::HumanPlace) {
        *visibility = Visibility::Hidden;
        return;
    }

    let kind = selected_piece.0;
    if game_state.pool(PLAYER_HUMAN).cats_in_hand == 0 && kind == PieceKind::Cat {
        // fall back visually
    }

    if let Some(coord) = cursor_coord.0
        && game_state.board().get(coord).is_none()
    {
        *visibility = Visibility::Visible;
        element.coord = coord;
        element.piece = Piece {
            player: PLAYER_HUMAN,
            kind,
        };
        transform.translation = scale_factor.screen_point(coord);
        transform.scale = Vec3::splat(scale_factor.factor);
        material.0 = if kind == PieceKind::Cat && game_state.pool(PLAYER_HUMAN).cats_in_hand > 0
        {
            materials.first_cat.clone()
        } else {
            materials.first_ghost.clone()
        };
        return;
    }

    *visibility = Visibility::Hidden;
}

fn handle_clicks(
    mouse: Res<ButtonInput<MouseButton>>,
    interaction_state: Res<InteractionState>,
    cursor_coord: Res<CursorCoord>,
    game_state: Res<GameState>,
    selected_piece: Res<HumanPieceChoice>,
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

    let mut piece_kind = selected_piece.0;
    let pool = game_state.pool(PLAYER_HUMAN);
    if piece_kind == PieceKind::Cat && pool.cats_in_hand == 0 {
        piece_kind = PieceKind::Kitten;
    }
    if piece_kind == PieceKind::Kitten && pool.kittens_in_hand == 0 {
        return;
    }

    player_move_events.write(PlayerMoveEvent(
        PLAYER_HUMAN,
        Move::Place {
            coord,
            piece: piece_kind,
        },
    ));
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
        .add_systems(Startup, setup_cursor)
        .add_systems(
            Update,
            (
                handle_resync.before(handle_board_updates),
                handle_board_updates
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
