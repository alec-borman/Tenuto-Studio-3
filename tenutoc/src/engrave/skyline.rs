pub struct Skyline {
    array: Vec<f32>,
    scale: f32,
    is_top: bool,
}

impl Skyline {
    pub fn new(width: f32, resolution: f32, is_top: bool) -> Self {
        let size = (width * resolution).ceil() as usize;
        Self {
            array: vec![0.0; size],
            scale: resolution,
            is_top,
        }
    }

    pub fn drop(&mut self, x: f32, width: f32, height: f32, current_y: f32) -> f32 {
        let start_idx = (x * self.scale).floor() as usize;
        let end_idx = ((x + width) * self.scale).ceil() as usize;
        let start_idx = start_idx.max(0);
        let end_idx = end_idx.min(self.array.len().saturating_sub(1));

        let mut extreme_y = if self.is_top { f32::INFINITY } else { f32::NEG_INFINITY };

        for i in start_idx..=end_idx {
            if self.is_top {
                if self.array[i] < extreme_y && self.array[i] != 0.0 {
                    extreme_y = self.array[i];
                }
            } else {
                if self.array[i] > extreme_y {
                    extreme_y = self.array[i];
                }
            }
        }

        if extreme_y == f32::NEG_INFINITY || extreme_y == f32::INFINITY || extreme_y == 0.0 {
            extreme_y = current_y;
        }

        let resolved_y = if self.is_top {
            current_y.min(extreme_y - height)
        } else {
            current_y.max(extreme_y + height)
        };

        for i in start_idx..=end_idx {
            self.array[i] = resolved_y;
        }

        resolved_y
    }

    pub fn insert(&mut self, x: f32, width: f32, y_extent: f32) {
        let start_idx = (x * self.scale).floor() as usize;
        let end_idx = ((x + width) * self.scale).ceil() as usize;
        let start_idx = start_idx.max(0);
        let end_idx = end_idx.min(self.array.len().saturating_sub(1));

        for i in start_idx..=end_idx {
            if self.is_top {
                if y_extent < self.array[i] || self.array[i] == 0.0 {
                    self.array[i] = y_extent;
                }
            } else {
                if y_extent > self.array[i] {
                    self.array[i] = y_extent;
                }
            }
        }
    }

    pub fn peek(&self, x: f32) -> f32 {
        let idx = (x * self.scale).floor() as usize;
        let idx = idx.max(0).min(self.array.len().saturating_sub(1));
        self.array[idx]
    }
}
