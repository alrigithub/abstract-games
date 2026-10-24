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
pub const LATTICE_STEPS: [(i8, i8); 6] = [(1, 0), (0, 1), (1, 1), (-1, 0), (0, -1), (-1, -1)];

/// Six outline vertices of the playable hex (Waltz / official board).
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

    pub fn sub(self, other: Self) -> Self {
        Self::new(self.x - other.x, self.y - other.y)
    }

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

const HOLE: Coord = Coord { x: 4, y: 4 };
const SEGMENT_EPS: f32 = 1e-3;

fn coord_key(c: Coord) -> (i8, i8) {
    (c.x, c.y)
}

fn ordered_pair(a: Coord, b: Coord) -> (Coord, Coord) {
    if coord_key(a) <= coord_key(b) {
        (a, b)
    } else {
        (b, a)
    }
}

fn touches_hole(a: Coord, b: Coord) -> bool {
    a == HOLE || b == HOLE
}

/// Undirected playable edges whose pixel length is exactly `spacing`.
///
/// Built from pixel distance, never from crate [`tzaar::DIRECTIONS`]. The
/// opposite-sign diagonal `(1,-1)` is a √3 step in this map and must not be
/// drawn. Segments that touch the centre hole are omitted.
pub fn neighbour_segments(spacing: f32) -> Vec<(Coord, Coord)> {
    let coords = tzaar::all_playable_coords();
    let mut segments = Vec::new();
    for (i, &a) in coords.iter().enumerate() {
        for &b in coords.iter().skip(i + 1) {
            if touches_hole(a, b) {
                continue;
            }
            let d = hex_to_pixel(a, spacing)
                .sub(hex_to_pixel(b, spacing))
                .length();
            if (d - spacing).abs() < SEGMENT_EPS {
                segments.push(ordered_pair(a, b));
            }
        }
    }
    segments
}

/// Unit edges along the six outer hexagon sides (corner → corner).
pub fn perimeter_segments(spacing: f32) -> Vec<(Coord, Coord)> {
    let mut segments = Vec::new();
    for i in 0..BOARD_CORNERS.len() {
        let start = BOARD_CORNERS[i];
        let end = BOARD_CORNERS[(i + 1) % BOARD_CORNERS.len()];
        let steps = walk_unit_edge(start, end, spacing);
        segments.extend(steps);
    }
    segments
}

/// All segments the board should draw: true pixel neighbours plus the hull.
pub fn grid_segments(spacing: f32) -> Vec<(Coord, Coord)> {
    let mut segments = neighbour_segments(spacing);
    for edge in perimeter_segments(spacing) {
        if !segments.contains(&edge) {
            segments.push(edge);
        }
    }
    segments
}

fn walk_unit_edge(start: Coord, end: Coord, spacing: f32) -> Vec<(Coord, Coord)> {
    let mut points = vec![start];
    let mut current = start;
    // Walk nearest-neighbour steps toward `end` (at most the hex diameter).
    for _ in 0..16 {
        if current == end {
            break;
        }
        let target = hex_to_pixel(end, spacing);
        let mut best: Option<(Coord, f32)> = None;
        for dir in LATTICE_STEPS {
            let next = tzaar::step(current, dir);
            if touches_hole(current, next) || !tzaar::is_playable(next) {
                continue;
            }
            let here = hex_to_pixel(current, spacing);
            let nxt = hex_to_pixel(next, spacing);
            if (nxt.sub(here).length() - spacing).abs() >= SEGMENT_EPS {
                continue;
            }
            let remaining = target.sub(nxt).length();
            if best.is_none_or(|(_, d)| remaining < d - 1e-4) {
                best = Some((next, remaining));
            }
        }
        let Some((next, _)) = best else {
            break;
        };
        if points.contains(&next) {
            break;
        }
        points.push(next);
        current = next;
    }
    points
        .windows(2)
        .map(|w| ordered_pair(w[0], w[1]))
        .collect()
}

/// Absolute heading of `b - a` folded into `[0, 180)`.
#[allow(dead_code)]
pub fn segment_angle_deg(a: Coord, b: Coord, spacing: f32) -> f32 {
    let pa = hex_to_pixel(a, spacing);
    let pb = hex_to_pixel(b, spacing);
    let mut deg = (pb.y - pa.y).atan2(pb.x - pa.x).to_degrees();
    while deg < 0.0 {
        deg += 180.0;
    }
    while deg >= 180.0 {
        deg -= 180.0;
    }
    deg
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

    fn angle_is_hex_family(deg: f32) -> bool {
        [30.0_f32, 90.0, 150.0]
            .into_iter()
            .any(|want| (deg - want).abs() < 1.0)
    }

    #[test]
    fn drawn_segments_are_unit_hex_families() {
        let segments = grid_segments(S);
        assert!(
            !segments.is_empty(),
            "expected neighbour + perimeter segments"
        );
        for (a, b) in &segments {
            assert_ne!(*a, HOLE);
            assert_ne!(*b, HOLE);
            let len = hex_to_pixel(*a, S).sub(hex_to_pixel(*b, S)).length();
            assert!(
                (len - S).abs() < 1e-3,
                "segment {a}–{b} length {len}, expected {S}"
            );
            let deg = segment_angle_deg(*a, *b, S);
            assert!(
                angle_is_hex_family(deg),
                "segment {a}–{b} angle {deg}, expected 30/90/150"
            );
        }
    }

    #[test]
    fn crate_opposite_diagonal_is_not_drawn() {
        let segments = grid_segments(S);
        for (a, b) in &segments {
            let dx = (b.x - a.x).abs();
            let dy = (b.y - a.y).abs();
            assert!(
                !(dx == 1 && dy == 1 && (b.x - a.x) == -(b.y - a.y)),
                "opposite-sign diagonal {a}–{b} must not be a grid segment"
            );
        }
    }
}
