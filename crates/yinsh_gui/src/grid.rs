use abstract_gui_theme::draw_segment;
use bevy::prelude::*;

use yinsh::Coord;

use crate::graphics::ScaleFactor;

pub fn draw_grid(mut gizmos: Gizmos, scale_factor: Res<ScaleFactor>) {
    for x in -5i8..=5i8 {
        let coords: Vec<_> = (-5..=5)
            .map(|y| Coord { x, y })
            .filter(|c| c.is_inside_board())
            .collect();

        let min_y = coords.iter().map(|c| c.y).min().unwrap();
        let max_y = coords.iter().map(|c| c.y).max().unwrap();

        draw_segment(
            &mut gizmos,
            scale_factor.screen_point(Coord { x, y: min_y }),
            scale_factor.screen_point(Coord { x, y: max_y }),
        );
    }

    for y in -5i8..=5i8 {
        let coords: Vec<_> = (-5..=5)
            .map(|x| Coord { x, y })
            .filter(|c| c.is_inside_board())
            .collect();

        let min_x = coords.iter().map(|c| c.x).min().unwrap();
        let max_x = coords.iter().map(|c| c.x).max().unwrap();

        draw_segment(
            &mut gizmos,
            scale_factor.screen_point(Coord { x: min_x, y }),
            scale_factor.screen_point(Coord { x: max_x, y }),
        );
    }

    for d in -5i8..=5i8 {
        let coords: Vec<_> = (-5..=5)
            .map(|x| Coord { x, y: x + d })
            .filter(|c| c.is_inside_board())
            .collect();

        let min = coords.iter().map(|c| c.x).min().unwrap();
        let max = coords.iter().map(|c| c.x).max().unwrap();

        draw_segment(
            &mut gizmos,
            scale_factor.screen_point(Coord { x: min, y: min + d }),
            scale_factor.screen_point(Coord { x: max, y: max + d }),
        );
    }
}
