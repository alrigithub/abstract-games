use std::f32::consts::TAU;

use bevy::{
    asset::RenderAssetUsages, mesh::Indices, prelude::*, render::render_resource::PrimitiveTopology,
};
use tzaar::{Piece, PieceKind, Player};

pub const R_TZAAR: f32 = 20.0;
pub const R_TZARRA: f32 = 15.5;
pub const R_TOTT: f32 = 11.0;

pub const INK: Color = Color::srgb(0.06, 0.06, 0.07);
pub const PAPER: Color = Color::srgb(0.96, 0.94, 0.88);
pub const MARK_ON_DARK: Color = Color::srgb(0.92, 0.90, 0.84);
#[derive(Resource)]
pub struct PieceDrawMaterials {
    pub fill_dark: Handle<ColorMaterial>,
    pub fill_light: Handle<ColorMaterial>,
    pub mark_dark: Handle<ColorMaterial>,
    pub mark_light: Handle<ColorMaterial>,
    pub stack_dark: Handle<ColorMaterial>,
    pub stack_light: Handle<ColorMaterial>,
}

#[derive(Component, Clone, Copy)]
#[expect(dead_code)]
pub struct StackPieceVisual {
    pub player: Player,
    pub kind: PieceKind,
    pub is_top: bool,
}

#[derive(Component)]
struct PieceFill;

#[derive(Component)]
struct PieceRing;

pub fn radius_for(kind: PieceKind) -> f32 {
    match kind {
        PieceKind::Tzaar => R_TZAAR,
        PieceKind::Tzarra => R_TZARRA,
        PieceKind::Tott => R_TOTT,
    }
}

pub fn setup_piece_materials(mut commands: Commands, mut materials: ResMut<Assets<ColorMaterial>>) {
    commands.insert_resource(PieceDrawMaterials {
        fill_dark: materials.add(ColorMaterial::from(INK)),
        fill_light: materials.add(ColorMaterial::from(PAPER)),
        mark_dark: materials.add(ColorMaterial::from(INK)),
        mark_light: materials.add(ColorMaterial::from(MARK_ON_DARK)),
        stack_dark: materials.add(ColorMaterial::from(INK.with_alpha(0.88))),
        stack_light: materials.add(ColorMaterial::from(PAPER.with_alpha(0.92))),
    });
}

fn fill_material(
    materials: &PieceDrawMaterials,
    player: Player,
    is_top: bool,
) -> Handle<ColorMaterial> {
    if !is_top {
        return match player {
            Player::First => materials.stack_light.clone(),
            Player::Second => materials.stack_dark.clone(),
        };
    }
    match player {
        Player::First => materials.fill_light.clone(),
        Player::Second => materials.fill_dark.clone(),
    }
}

fn mark_material(materials: &PieceDrawMaterials, player: Player) -> Handle<ColorMaterial> {
    match player {
        Player::First => materials.mark_dark.clone(),
        Player::Second => materials.mark_light.clone(),
    }
}

fn ring_mesh(inner_radius: f32, outer_radius: f32, segments: u32) -> Mesh {
    let mut positions = Vec::with_capacity(segments as usize * 4);
    let mut indices = Vec::with_capacity(segments as usize * 6);
    for i in 0..segments {
        let a0 = i as f32 / segments as f32 * TAU;
        let a1 = (i + 1) as f32 / segments as f32 * TAU;
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

fn thin_ring_mesh(radius: f32, thickness: f32) -> Mesh {
    ring_mesh((radius - thickness).max(0.0), radius + thickness, 64)
}

fn spawn_ring(
    parent: &mut ChildSpawnerCommands,
    meshes: &mut Assets<Mesh>,
    material: Handle<ColorMaterial>,
    inner: f32,
    outer: f32,
    z: f32,
) {
    parent.spawn((
        Mesh2d(meshes.add(ring_mesh(inner, outer, 64))),
        MeshMaterial2d(material),
        PieceRing,
        Transform::from_xyz(0., 0., z),
    ));
}

fn spawn_glyph_rings(
    parent: &mut ChildSpawnerCommands,
    meshes: &mut Assets<Mesh>,
    material: Handle<ColorMaterial>,
    player: Player,
    kind: PieceKind,
    radius: f32,
) {
    match player {
        Player::Second => match kind {
            PieceKind::Tzaar => {
                spawn_ring(
                    parent,
                    meshes,
                    material.clone(),
                    radius * 0.58,
                    radius * 0.66,
                    0.03,
                );
                spawn_ring(parent, meshes, material, radius * 0.34, radius * 0.42, 0.04);
            }
            PieceKind::Tzarra => {
                spawn_ring(parent, meshes, material, radius * 0.48, radius * 0.56, 0.03);
            }
            PieceKind::Tott => {}
        },
        Player::First => {
            let stroke = 3.0;
            match kind {
                PieceKind::Tzaar => {
                    spawn_ring(
                        parent,
                        meshes,
                        material.clone(),
                        radius - stroke,
                        radius,
                        0.02,
                    );
                    spawn_ring(
                        parent,
                        meshes,
                        material.clone(),
                        radius * 0.54,
                        radius * 0.62,
                        0.03,
                    );
                    spawn_ring(parent, meshes, material, radius * 0.32, radius * 0.40, 0.04);
                }
                PieceKind::Tzarra => {
                    spawn_ring(
                        parent,
                        meshes,
                        material.clone(),
                        radius - stroke,
                        radius,
                        0.02,
                    );
                    spawn_ring(parent, meshes, material, radius * 0.46, radius * 0.54, 0.03);
                }
                PieceKind::Tott => {
                    spawn_ring(parent, meshes, material, radius - stroke, radius, 0.02);
                }
            }
        }
    }
}

/// Spawns one stack layer (meshes for fill, rings, and center mark).
#[expect(clippy::too_many_arguments)]
pub fn spawn_stack_piece(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &PieceDrawMaterials,
    piece: Piece,
    is_top: bool,
    ghost: bool,
) -> Entity {
    let radius = radius_for(piece.kind);
    let ring_mat = mark_material(materials, piece.player);
    let mut entity = commands.spawn((
        StackPieceVisual {
            player: piece.player,
            kind: piece.kind,
            is_top,
        },
        Visibility::Visible,
    ));

    let show_fill = match piece.player {
        Player::Second => true,
        Player::First => is_top && !ghost,
    };

    entity.with_children(|parent| {
        if show_fill {
            let mat = fill_material(materials, piece.player, is_top);
            parent.spawn((
                Mesh2d(meshes.add(Circle::new(radius))),
                MeshMaterial2d(mat),
                PieceFill,
                Transform::from_xyz(0., 0., 0.01),
            ));
        } else if !is_top {
            parent.spawn((
                Mesh2d(meshes.add(Circle::new(radius * 0.92))),
                MeshMaterial2d(materials.stack_light.clone()),
                PieceFill,
                Transform::from_xyz(0., 0., 0.01),
            ));
        }

        if !is_top {
            let rim = thin_ring_mesh(radius * 0.94, 0.9);
            let rim_color = match piece.player {
                Player::First => materials.mark_dark.clone(),
                Player::Second => materials.mark_light.clone(),
            };
            parent.spawn((
                Mesh2d(meshes.add(rim)),
                MeshMaterial2d(rim_color),
                PieceRing,
                Transform::from_xyz(0., 0., 0.02),
            ));
        }

        if is_top {
            spawn_glyph_rings(
                parent,
                meshes,
                ring_mat.clone(),
                piece.player,
                piece.kind,
                radius,
            );

            let needs_dot = matches!(
                (piece.player, piece.kind),
                (Player::Second, PieceKind::Tzaar | PieceKind::Tzarra)
                    | (Player::First, PieceKind::Tzaar | PieceKind::Tzarra)
            );
            if needs_dot {
                let dot_r = radius * 0.11;
                parent.spawn((
                    Mesh2d(meshes.add(Circle::new(dot_r))),
                    MeshMaterial2d(ring_mat),
                    Transform::from_xyz(0., 0., 0.05),
                ));
            }
        }
    });

    entity.id()
}

pub fn plugin(app: &mut App) {
    app.add_systems(PreStartup, setup_piece_materials);
}
