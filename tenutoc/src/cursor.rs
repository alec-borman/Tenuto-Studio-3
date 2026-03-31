use crate::ir::Rational;

#[derive(Debug, Clone)]
pub struct Cursor {
    pub last_duration: Rational,
    pub last_octave: i8,
    pub last_velocity: u8,
    pub last_articulations: Vec<String>,
}

impl Cursor {
    pub fn new() -> Self {
        Self {
            last_duration: Rational::new(1, 4), // Default to quarter note
            last_octave: 4,                     // Default to octave 4
            last_velocity: 100,                 // Default velocity
            last_articulations: Vec::new(),
        }
    }

    pub fn update(&mut self, duration: Option<Rational>, octave: Option<i8>, velocity: Option<u8>, articulations: Option<Vec<String>>) {
        if let Some(d) = duration {
            self.last_duration = d;
        }
        if let Some(o) = octave {
            self.last_octave = o;
        }
        if let Some(v) = velocity {
            self.last_velocity = v;
        }
        if let Some(a) = articulations {
            self.last_articulations = a;
        }
    }

    pub fn reset_strict(&mut self) {
        self.last_articulations.clear();
        // Depending on strict mode rules, duration/octave might reset too,
        // but typically articulations are the main thing cleared at barlines.
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cursor_stickiness() {
        let mut cursor = Cursor::new();
        assert_eq!(cursor.last_octave, 4);

        cursor.update(None, Some(5), None, None);
        assert_eq!(cursor.last_octave, 5);

        // Next event updates duration but not octave
        cursor.update(Some(Rational::new(1, 8)), None, None, None);
        assert_eq!(cursor.last_octave, 5); // Octave stuck
        assert_eq!(cursor.last_duration, Rational::new(1, 8));
    }

    #[test]
    fn test_cursor_strict_reset() {
        let mut cursor = Cursor::new();
        cursor.update(None, None, None, Some(vec!["staccato".to_string()]));
        assert_eq!(cursor.last_articulations.len(), 1);

        cursor.reset_strict();
        assert_eq!(cursor.last_articulations.len(), 0);
    }
}
