use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AccidentalDisplay {
    Implicit,
    Explicit,
    Cautionary,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
pub enum Step {
    C, D, E, F, G, A, B,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Spelling {
    pub step: Step,
    pub octave: u8,
    pub alter: i8,
    pub display: AccidentalDisplay,
}

#[derive(Debug, Clone)]
pub struct AccidentalStateMachine {
    // Rule 2: Tracks active alterations independently per Step and Octave index.
    active_accidentals: HashMap<(Step, u8), i8>,
    // Global key signature represented numerically (e.g., -1 for F Major, +1 for G Major)
    key_signature: i8,
}

impl AccidentalStateMachine {
    pub fn new(key_signature: i8) -> Self {
        Self {
            active_accidentals: HashMap::new(),
            key_signature,
        }
    }

    /// Rule 1: The memory array MUST be wiped clean at every absolute barline.
    pub fn reset_measure(&mut self) {
        self.active_accidentals.clear();
    }

    /// Derives visually accurate Step and Alter attributes from raw MIDI integers.
    /// Algorithmically prefers sharps in sharp keys and flats in flat keys.
    fn get_line_of_fifths_derivation(midi_pitch: u8, key_signature: i8) -> (Step, i8) {
        let pitch_class = midi_pitch % 12;
        let prefer_flats = key_signature < 0;

        match pitch_class {
            0 => (Step::C, 0),
            1 => if prefer_flats { (Step::D, -1) } else { (Step::C, 1) },
            2 => (Step::D, 0),
            3 => if prefer_flats { (Step::E, -1) } else { (Step::D, 1) },
            4 => (Step::E, 0),
            5 => (Step::F, 0),
            6 => if prefer_flats { (Step::G, -1) } else { (Step::F, 1) },
            7 => (Step::G, 0),
            8 => if prefer_flats { (Step::A, -1) } else { (Step::G, 1) },
            9 => (Step::A, 0),
            10 => if prefer_flats { (Step::B, -1) } else { (Step::A, 1) },
            11 => (Step::B, 0),
            _ => unreachable!(),
        }
    }

    /// Interrogates the active Key Signature to find the baseline accidental for a diatonic step.
    fn get_baseline_alteration(step: Step, key_signature: i8) -> i8 {
        if key_signature > 0 {
            let sharps = match step {
                Step::F => 1, Step::C => 2, Step::G => 3, Step::D => 4,
                Step::A => 5, Step::E => 6, Step::B => 7,
            };
            if key_signature >= sharps { return 1; }
        } else if key_signature < 0 {
            let flats = match step {
                Step::B => -1, Step::E => -2, Step::A => -3, Step::D => -4,
                Step::G => -5, Step::C => -6, Step::F => -7,
            };
            if key_signature <= flats { return -1; }
        }
        0
    }

    /// Translates raw MIDI integer pitches into visually correct diatonic spellings.
    pub fn spell_pitch(&mut self, midi_pitch: u8) -> Spelling {
        // Standard MIDI calculation (Middle C4 = 60 -> 60/12 - 1 = 4)
        let octave = (midi_pitch / 12).saturating_sub(1);
        
        let (step, alter) = Self::get_line_of_fifths_derivation(midi_pitch, self.key_signature);
        let baseline_alter = Self::get_baseline_alteration(step, self.key_signature);

        // Rule 3: Explicit cancellations if deviating from memory or baseline key signature
        let display = match self.active_accidentals.get(&(step, octave)) {
            Some(&active_alter) => {
                if active_alter == alter {
                    AccidentalDisplay::Implicit
                } else {
                    AccidentalDisplay::Explicit // Forces a natural sign canceling a previous accidental
                }
            }
            None => {
                if alter == baseline_alter {
                    AccidentalDisplay::Implicit
                } else {
                    AccidentalDisplay::Explicit // Accidental outside the key signature
                }
            }
        };

        // Update Elaine Gould's accidental memory array
        self.active_accidentals.insert((step, octave), alter);

        Spelling {
            step,
            octave,
            alter,
            display,
        }
    }
}