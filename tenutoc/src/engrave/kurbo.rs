use super::skyline::Skyline;

#[derive(Clone, Copy, Debug)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

pub struct Kurbo;

impl Kurbo {
    pub fn route_slur(
        p0: Point,
        p3: Point,
        skyline: &Skyline,
        is_top: bool,
        measure_x: f32,
    ) -> [Point; 4] {
        let dx = p3.x - p0.x;
        let dir = if is_top { -1.0 } else { 1.0 };

        let mut p1 = Point {
            x: p0.x + dx / 3.0,
            y: p0.y + dir * 15.0,
        };
        let mut p2 = Point {
            x: p3.x - dx / 3.0,
            y: p3.y + dir * 15.0,
        };

        let steps = 20;
        let mut max_violation = 0.0;
        let mut max_violation_t = 0.0;
        let mut iterations = 0;

        loop {
            max_violation = 0.0;
            max_violation_t = 0.0;

            for i in 0..=steps {
                let t = i as f32 / steps as f32;
                let pt = Self::evaluate_cubic(p0, p1, p2, p3, t);

                let skyline_y = skyline.peek((measure_x + pt.x) / 10.0);

                if is_top {
                    if skyline_y != 0.0 && pt.y > skyline_y - 5.0 {
                        let violation = pt.y - (skyline_y - 5.0);
                        if violation > max_violation {
                            max_violation = violation;
                            max_violation_t = t;
                        }
                    }
                } else {
                    if skyline_y != 0.0 && pt.y < skyline_y + 5.0 {
                        let violation = (skyline_y + 5.0) - pt.y;
                        if violation > max_violation {
                            max_violation = violation;
                            max_violation_t = t;
                        }
                    }
                }
            }

            if max_violation > 0.0 {
                if max_violation_t < 0.5 {
                    p1.y += dir * (max_violation * 2.0 + 2.0);
                    p2.y += dir * (max_violation * 1.0 + 2.0);
                } else if max_violation_t > 0.5 {
                    p1.y += dir * (max_violation * 1.0 + 2.0);
                    p2.y += dir * (max_violation * 2.0 + 2.0);
                } else {
                    p1.y += dir * (max_violation * 1.5 + 2.0);
                    p2.y += dir * (max_violation * 1.5 + 2.0);
                }
            }

            iterations += 1;
            if max_violation <= 0.0 || iterations >= 10 {
                break;
            }
        }

        [p0, p1, p2, p3]
    }

    fn evaluate_cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: f32) -> Point {
        let mt = 1.0 - t;
        let mt2 = mt * mt;
        let mt3 = mt2 * mt;
        let t2 = t * t;
        let t3 = t2 * t;

        Point {
            x: mt3 * p0.x + 3.0 * mt2 * t * p1.x + 3.0 * mt * t2 * p2.x + t3 * p3.x,
            y: mt3 * p0.y + 3.0 * mt2 * t * p1.y + 3.0 * mt * t2 * p2.y + t3 * p3.y,
        }
    }
}
