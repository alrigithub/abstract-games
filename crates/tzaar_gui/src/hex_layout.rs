use tzaar::Coord;

/// Outer piece radius as a fraction of intersection spacing.
pub const PIECE_RADIUS_FRAC: f32 = 0.40;

/// Tzarra / Tzaar inner-ring stroke as a fraction of intersection spacing.
pub const RING_WIDTH_FRAC: f32 = 0.08;

/// Lattice steps that this pixel map sends to unit 60° vectors.
///
/// Crate [`tzaar::DIRECTIONS`] uses the opposite-sign diagonal `(1,-1)`.
/// Treating those as nearest neighbours (standard axial) shears the official
/// TEMPLATE into a top-left→bottom-right band. TEMPLATE is a hex on the
/// *same-sign* diagonal, so the map below is derived from
/// `(±1,0), (0,±1), (±1,±1)`: `x = 1.5 s q`, `y = √3 s (r − q/2)`,
/// with `s = spacing / √3` so each of those six steps has length `spacing`.
/// Screen Y is flipped so TEMPLATE row 0 sits at the top of the window.
#[allow(dead_code)]
pub const LATTICE_STEPS: [(i8, i8); 6] = [(1, 0), (0, 1), (1, 1), (-1, 0), (0, -1), (-1, -1)];

/// Six outline vertices of the playable hex (Waltz / official board).
#[allow(dead_code)]
pub const BOARD_CORNERS: [Coord; 6] = [
    Coord { x: 0, y: 0 },
    Coord { x: 4, y: 0 },
    Coord { x: 8, y: 4 },
    Coord { x: 8, y: 8 },
    Coord { x: 4, y: 8 },
    Coord { x: 0, y: 4 },
];

#[derive(Clone, Copy, Debug)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    #[allow(dead_code)]
    pub fn sub(self, other: Self) -> Self {
        Self::new(self.x - other.x, self.y - other.y)
    }

    #[allow(dead_code)]
    pub fn length(self) -> f32 {
        self.x.hypot(self.y)
    }
}

pub fn hex_to_pixel(coord: Coord, spacing: f32) -> Vec2 {
    let q = coord.x as f32;
    let r = coord.y as f32;
    let size = spacing / 3.0_f32.sqrt();
    let x = 1.5 * size * q;
    let y = -(3.0_f32.sqrt() * size * (r - q * 0.5));
    Vec2 { x, y }
}

pub const fn piece_radius(spacing: f32) -> f32 {
    spacing * PIECE_RADIUS_FRAC
}

/// Axis-aligned bounds of every playable intersection at the given spacing.
pub fn playable_bounds(spacing: f32) -> (Vec2, Vec2) {
    let mut min = Vec2::new(f32::MAX, f32::MAX);
    let mut max = Vec2::new(f32::MIN, f32::MIN);
    for coord in tzaar::all_playable_coords() {
        let p = hex_to_pixel(coord, spacing);
        min.x = min.x.min(p.x);
        min.y = min.y.min(p.y);
        max.x = max.x.max(p.x);
        max.y = max.y.max(p.y);
    }
    (min, max)
}

/// World-space margin around the playable hull (piece radius plus padding).
pub fn fit_margin(spacing: f32) -> f32 {
    spacing * (PIECE_RADIUS_FRAC + 0.65)
}

/// Orthographic `scale` (Bevy `ScalingMode::WindowSize`) that fits the board
/// plus margin into `window_w` × `window_h`. Recompute on resize.
pub fn ortho_scale_to_fit(window_w: f32, window_h: f32, spacing: f32) -> f32 {
    let (min, max) = playable_bounds(spacing);
    let margin = fit_margin(spacing);
    let bw = (max.x - min.x) + 2.0 * margin;
    let bh = (max.y - min.y) + 2.0 * margin;
    let w = window_w.max(1.0);
    let h = window_h.max(1.0);
    (bw / w).max(bh / h)
}

pub fn origin_to_center(spacing: f32) -> Vec2 {
    let (min, max) = playable_bounds(spacing);
    Vec2::new(-(min.x + max.x) * 0.5, -(min.y + max.y) * 0.5)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tzaar::step;

    const S: f32 = 10.0;
    const EPS: f32 = 1e-4;

    #[test]
    fn every_neighbour_is_exactly_spacing() {
        let origin = Coord::new(4, 3);
        for dir in LATTICE_STEPS {
            let delta = hex_to_pixel(step(origin, dir), S).sub(hex_to_pixel(origin, S));
            assert!(
                (delta.length() - S).abs() < EPS,
                "dir {dir:?} length {}",
                delta.length()
            );
        }
    }

    #[test]
    fn six_corner_points_form_a_regular_hexagon() {
        let centre = hex_to_pixel(Coord::new(4, 4), S);
        let mut radii = Vec::new();
        for corner in BOARD_CORNERS {
            let p = hex_to_pixel(corner, S);
            radii.push((p.x - centre.x).hypot(p.y - centre.y));
        }
        let r0 = radii[0];
        for r in &radii {
            assert!((r - r0).abs() < EPS, "radii {radii:?}");
        }
        assert!(r0 > 0.0);
    }

    #[test]
    fn six_lattice_neighbours_form_a_regular_hexagon() {
        let origin = Coord::new(4, 3);
        let c = hex_to_pixel(origin, S);
        let mut radii = Vec::new();
        for dir in LATTICE_STEPS {
            let p = hex_to_pixel(step(origin, dir), S);
            radii.push((p.x - c.x).hypot(p.y - c.y));
        }
        let r0 = radii[0];
        for r in &radii {
            assert!((r - r0).abs() < EPS, "radii {radii:?}");
        }
        assert!((r0 - S).abs() < EPS);
    }

    #[test]
    fn piece_radius_is_two_fifths_of_spacing() {
        assert!((PIECE_RADIUS_FRAC - 0.40).abs() < EPS);
        assert!((piece_radius(S) - 0.40 * S).abs() < EPS);
        assert!(
            (crate::piece_visual::PIECE_RADIUS / crate::graphics::BASE_SPACING - 0.40).abs() < EPS
        );
    }

    #[test]
    fn fitted_board_stays_inside_window() {
        let spacing = 58.0;
        let (min, max) = playable_bounds(spacing);
        let margin = fit_margin(spacing);
        let scale = ortho_scale_to_fit(900.0, 820.0, spacing);
        let visible_w = 900.0 * scale;
        let visible_h = 820.0 * scale;
        assert!(visible_w + 1e-3 >= (max.x - min.x) + 2.0 * margin);
        assert!(visible_h + 1e-3 >= (max.y - min.y) + 2.0 * margin);
    }
}
