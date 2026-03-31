// MusicXML export
use crate::spelling::{AccidentalStateMachine, AccidentalDisplay, Step};

pub struct XmlEmitter {
    state_machine: AccidentalStateMachine,
}

impl XmlEmitter {
    pub fn new(key_signature: i8) -> Self {
        Self {
            state_machine: AccidentalStateMachine::new(key_signature),
        }
    }

    pub fn reset_measure(&mut self) {
        self.state_machine.reset_measure();
    }

    pub fn generate_note_xml(&mut self, midi_pitch: u8) -> String {
        let spelling = self.state_machine.spell_pitch(midi_pitch);
        
        let step_str = match spelling.step {
            Step::C => "C",
            Step::D => "D",
            Step::E => "E",
            Step::F => "F",
            Step::G => "G",
            Step::A => "A",
            Step::B => "B",
        };

        let mut xml = String::new();
        xml.push_str("<pitch>\n");
        xml.push_str(&format!("  <step>{}</step>\n", step_str));
        if spelling.alter != 0 {
            xml.push_str(&format!("  <alter>{}</alter>\n", spelling.alter));
        }
        xml.push_str(&format!("  <octave>{}</octave>\n", spelling.octave));
        xml.push_str("</pitch>\n");

        if spelling.display == AccidentalDisplay::Explicit {
            let accidental_str = match spelling.alter {
                1 => "sharp",
                0 => "natural",
                -1 => "flat",
                _ => "",
            };
            if !accidental_str.is_empty() {
                xml.push_str(&format!("<accidental>{}</accidental>\n", accidental_str));
            }
        }

        xml
    }
}
