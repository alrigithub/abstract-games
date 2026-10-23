use std::f32::consts::TAU;

use bevy::{
    asset::RenderAssetUsages, mesh::Indices, prelude::*, render::render_resource::PrimitiveTopology,
};
use tzaar::{Piece, PieceKind, Player};

use crate::board_entity::{BoardElement, CursorElement};
use crate::graphics::FOREGROUND_RENDER_LAYER;

pub const R_TZAAR: f32 = 20.0;
pub const R_TZARRA: f32 = 15.5;
pub const R_TOTT: f32 = 11.0;

pub const INK: Color = Color::srgb(0.06, 0.06, 0.07);
pub const PAPER: Color = Color::srgb(0.96, 0.94, 0.88);
pub const MARK_ON_DARK: Color = Color::srgb(0.92, 0.90, 0.84);

const RING_SEGMENTS: u32 = 40;

#[derive(Resource)]
pub struct PieceDrawMaterials {
    pub fill_dark: Handle<ColorMaterial>,
    pub fill_light: Handle<ColorMaterial>,
    pub mark_dark: Handle<ColorMaterial>,
    pub mark_light: Handle<ColorMaterial>,
    pub stack_dark: Handle<ColorMaterial>,
    pub stack_light: Handle<ColorMaterial>,
}

/// Shared mesh handles — created once at startup (avoids thousands of unique GPU assets).
#[derive(Resource)]
pub struct PieceMeshes {
    pub fill: [Handle<Mesh>; 3],
    pub stack_disc: [Handle<Mesh>; 3],
    pub stack_rim: [Handle<Mesh>; 3],
    pub center_dot: [Handle<Mesh>; 3],
    pub white_outer_ring: [Handle<Mesh>; 3],
    pub white_inner_tzarra: Handle<Mesh>,
    pub white_inner_tzaar: Handle<Mesh>,
    pub white_mid_tzaar: Handle<Mesh>,
    pub black_ring_tzarra: Handle<Mesh>,
    pub black_ring_tzaar_outer: Handle<Mesh>,
    pub black_ring_tzaar_inner: Handle<Mesh>,
}

pub fn radius_for(kind: PieceKind) -> f32 {
    match kind {
        PieceKind::Tzaar => R_TZAAR,
        PieceKind::Tzarra => R_TZARRA,
        PieceKind::Tott => R_TOTT,
    }
}

fn kind_index(kind: PieceKind) -> usize {
    match kind {
        PieceKind::Tzaar => 0,
        PieceKind::Tzarra => 1,
        PieceKind::Tott => 2,
    }
}

fn ring_mesh(inner_radius: f32, outer_radius: f32) -> Mesh {
    let mut positions = Vec::with_capacity(RING_SEGMENTS as usize * 4);
    let mut indices = Vec::with_capacity(RING_SEGMENTS as usize * 6);
    for i in 0..RING_SEGMENTS {
        let a0 = i as f32 / RING_SEGMENTS as f32 * TAU;
        let a1 = (i + 1) as f32 / RING_SEGMENTS as f32 * TAU;
        let (s0, c0) = a0.sin_cos();
        let (s1, c1) = a1.sin_cos();
        let base = positions.len() as u32;
        positions.push([c0 * outer_radius, s0 * outer_radius, 0.0]);
        positions.push([c1 * outer_radius, s1 * outer_radius, 0.0]);
        positions.push([c0 * inner_radius, s0 * inner_radius, 0.0]);
        positions.push([c1 * inner_radius, s1 * inner_radius, 0.0]);
        indices.extend_from_slice(&[base, base + 1, base + 2, base + 1, base + 3, base + 2]);
    }
    let mut mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::default(),
    );
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
    mesh.insert_indices(Indices::U32(indices));
    mesh
}

fn add_ring(meshes: &mut Assets<Mesh>, inner: f32, outer: f32) -> Handle<Mesh> {
    meshes.add(ring_mesh(inner, outer))
}

pub fn setup_piece_assets(
    mut commands: Commands,
    mut materials: ResMut<Assets<ColorMaterial>>,
    mut meshes: ResMut<Assets<Mesh>>,
) {
    commands.insert_resource(PieceDrawMaterials {
        fill_dark: materials.add(ColorMaterial::from(INK)),
        fill_light: materials.add(ColorMaterial::from(PAPER)),
        mark_dark: materials.add(ColorMaterial::from(INK)),
        mark_light: materials.add(ColorMaterial::from(MARK_ON_DARK)),
        stack_dark: materials.add(ColorMaterial::from(INK.with_alpha(0.88))),
        stack_light: materials.add(ColorMaterial::from(PAPER.with_alpha(0.92))),
    });

    let fill = [
        meshes.add(Circle::new(R_TZAAR)),
        meshes.add(Circle::new(R_TZARRA)),
        meshes.add(Circle::new(R_TOTT)),
    ];
    let stack_disc = [
        meshes.add(Circle::new(R_TZAAR * 0.92)),
        meshes.add(Circle::new(R_TZARRA * 0.92)),
        meshes.add(Circle::new(R_TOTT * 0.92)),
    ];
    let stack_rim = [
        add_ring(&mut meshes, R_TZAAR * 0.85, R_TZAAR * 0.97),
        add_ring(&mut meshes, R_TZARRA * 0.85, R_TZARRA * 0.97),
        add_ring(&mut meshes, R_TOTT * 0.85, R_TOTT * 0.97),
    ];
    let center_dot = [
        meshes.add(Circle::new(R_TZAAR * 0.11)),
        meshes.add(Circle::new(R_TZARRA * 0.11)),
        meshes.add(Circle::new(R_TOTT * 0.11)),
    ];
    let white_stroke = 3.0;
    let white_outer_ring = [
        add_ring(&mut meshes, R_TZAAR - white_stroke, R_TZAAR),
        add_ring(&mut meshes, R_TZARRA - white_stroke, R_TZARRA),
        add_ring(&mut meshes, R_TOTT - white_stroke, R_TOTT),
    ];

    commands.insert_resource(PieceMeshes {
        fill,
        stack_disc,
        stack_rim,
        center_dot,
        white_outer_ring,
        white_inner_tzarra: add_ring(&mut meshes, R_TZARRA * 0.46, R_TZARRA * 0.54),
        white_inner_tzaar: add_ring(&mut meshes, R_TZAAR * 0.32, R_TZAAR * 0.40),
        white_mid_tzaar: add_ring(&mut meshes, R_TZAAR * 0.54, R_TZAAR * 0.62),
        black_ring_tzarra: add_ring(&mut meshes, R_TZARRA * 0.48, R_TZARRA * 0.56),
        black_ring_tzaar_outer: add_ring(&mut meshes, R_TZAAR * 0.58, R_TZAAR * 0.66),
        black_ring_tzaar_inner: add_ring(&mut meshes, R_TZAAR * 0.34, R_TZAAR * 0.42),
    });
}

fn spawn_part(
    commands: &mut Commands,
    mesh: Handle<Mesh>,
    material: Handle<ColorMaterial>,
    transform: Transform,
    visibility: Visibility,
    board: BoardElement,
    cursor: bool,
) {
    if cursor {
        commands.spawn((
            Mesh2d(mesh),
            MeshMaterial2d(material),
            transform,
            visibility,
            FOREGROUND_RENDER_LAYER,
            board,
            CursorElement,
        ));
    } else {
        commands.spawn((
            Mesh2d(mesh),
            MeshMaterial2d(material),
            transform,
            visibility,
            FOREGROUND_RENDER_LAYER,
            board,
        ));
    }
}

/// Spawns all mesh layers for one stack disc (flat entities, shared meshes, no child hierarchy).
pub fn spawn_stack_piece_at(
    commands: &mut Commands,
    piece_meshes: &PieceMeshes,
    materials: &PieceDrawMaterials,
    piece: Piece,
    is_top: bool,
    ghost: bool,
    transform: Transform,
    board: BoardElement,
    cursor: bool,
) {
    let ki = kind_index(piece.kind);
    let z = transform.translation.z;
    let visibility = if cursor {
        Visibility::Hidden
    } else {
        Visibility::Visible
    };

    let spawn_layer =
        |commands: &mut Commands, mesh: Handle<Mesh>, mat: Handle<ColorMaterial>, dz: f32| {
            let mut t = transform;
            t.translation.z = z + dz;
            spawn_part(commands, mesh, mat, t, visibility, board, cursor);
        };

    match piece.player {
        Player::Second => {
            let fill_mat = if is_top {
                materials.fill_dark.clone()
            } else {
                materials.stack_dark.clone()
            };
            spawn_layer(commands, piece_meshes.fill[ki].clone(), fill_mat, 0.01);
            if is_top {
                match piece.kind {
                    PieceKind::Tzaar => {
                        spawn_layer(
                            commands,
                            piece_meshes.black_ring_tzaar_outer.clone(),
                            materials.mark_light.clone(),
                            0.03,
                        );
                        spawn_layer(
                            commands,
                            piece_meshes.black_ring_tzaar_inner.clone(),
                            materials.mark_light.clone(),
                            0.04,
                        );
                        spawn_layer(
                            commands,
                            piece_meshes.center_dot[ki].clone(),
                            materials.mark_light.clone(),
                            0.05,
                        );
                    }
                    PieceKind::Tzarra => {
                        spawn_layer(
                            commands,
                            piece_meshes.black_ring_tzarra.clone(),
                            materials.mark_light.clone(),
                            0.03,
                        );
                        spawn_layer(
                            commands,
                            piece_meshes.center_dot[ki].clone(),
                            materials.mark_light.clone(),
                            0.05,
                        );
                    }
                    PieceKind::Tott => {}
                }
            } else {
                spawn_layer(
                    commands,
                    piece_meshes.stack_rim[ki].clone(),
                    materials.mark_light.clone(),
                    0.02,
                );
            }
        }
        Player::First => {
            if is_top && !ghost {
                spawn_layer(
                    commands,
                    piece_meshes.fill[ki].clone(),
                    materials.fill_light.clone(),
                    0.01,
                );
            } else if !is_top {
                spawn_layer(
                    commands,
                    piece_meshes.stack_disc[ki].clone(),
                    materials.stack_light.clone(),
                    0.01,
                );
                spawn_layer(
                    commands,
                    piece_meshes.stack_rim[ki].clone(),
                    materials.mark_dark.clone(),
                    0.02,
                );
            }

            if is_top {
                spawn_layer(
                    commands,
                    piece_meshes.white_outer_ring[ki].clone(),
                    materials.mark_dark.clone(),
                    0.02,
                );
                match piece.kind {
                    PieceKind::Tzaar => {
                        spawn_layer(
                            commands,
                            piece_meshes.white_mid_tzaar.clone(),
                            materials.mark_dark.clone(),
                            0.03,
                        );
                        spawn_layer(
                            commands,
                            piece_meshes.white_inner_tzaar.clone(),
                            materials.mark_dark.clone(),
                            0.04,
                        );
                        spawn_layer(
                            commands,
                            piece_meshes.center_dot[ki].clone(),
                            materials.mark_dark.clone(),
                            0.05,
                        );
                    }
                    PieceKind::Tzarra => {
                        spawn_layer(
                            commands,
                            piece_meshes.white_inner_tzarra.clone(),
                            materials.mark_dark.clone(),
                            0.03,
                        );
                        spawn_layer(
                            commands,
                            piece_meshes.center_dot[ki].clone(),
                            materials.mark_dark.clone(),
                            0.05,
                        );
                    }
                    PieceKind::Tott => {}
                }
            }
        }
    }
}

pub fn plugin(app: &mut App) {
    app.add_systems(PreStartup, setup_piece_assets);
}
