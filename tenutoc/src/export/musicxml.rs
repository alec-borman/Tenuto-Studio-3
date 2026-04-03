// MusicXML export
use crate::ir::{Timeline, TimelineNode, EventKind};
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

    pub fn generate_note_xml(&mut self, midi_pitch: u8, duration: u32, is_tie_start: bool, is_tie_stop: bool, beam: Option<&str>, dynamics: Option<&str>) -> String {
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
        xml.push_str("<note>\n");
        xml.push_str("  <pitch>\n");
        xml.push_str(&format!("    <step>{}</step>\n", step_str));
        if spelling.alter != 0 {
            xml.push_str(&format!("    <alter>{}</alter>\n", spelling.alter));
        }
        xml.push_str(&format!("    <octave>{}</octave>\n", spelling.octave));
        xml.push_str("  </pitch>\n");
        xml.push_str(&format!("  <duration>{}</duration>\n", duration));

        if is_tie_stop {
            xml.push_str("  <tie type=\"stop\"/>\n");
        }
        if is_tie_start {
            xml.push_str("  <tie type=\"start\"/>\n");
        }

        if spelling.display == AccidentalDisplay::Explicit {
            let accidental_str = match spelling.alter {
                1 => "sharp",
                0 => "natural",
                -1 => "flat",
                _ => "",
            };
            if !accidental_str.is_empty() {
                xml.push_str(&format!("  <accidental>{}</accidental>\n", accidental_str));
            }
        }

        if let Some(b) = beam {
            xml.push_str(&format!("  <beam number=\"1\">{}</beam>\n", b));
        }
        
        if let Some(dyn_mark) = dynamics {
            xml.push_str("  <notations>\n");
            xml.push_str("    <dynamics>\n");
            xml.push_str(&format!("      <{dyn_mark}/>\n"));
            xml.push_str("    </dynamics>\n");
            xml.push_str("  </notations>\n");
        }

        xml.push_str("</note>\n");
        xml
    }

    pub fn export_timeline(&mut self, timeline: &Timeline) -> String {
        let mut xml = String::new();
        xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n");
        xml.push_str("<!DOCTYPE score-partwise PUBLIC \"-//Recordare//DTD MusicXML 4.0 Partwise//EN\" \"http://www.musicxml.org/dtds/partwise.dtd\">\n");
        xml.push_str("<score-partwise version=\"4.0\">\n");
        xml.push_str("  <part-list>\n");
        xml.push_str("    <score-part id=\"P1\">\n");
        xml.push_str("      <part-name>Music</part-name>\n");
        xml.push_str("    </score-part>\n");
        xml.push_str("  </part-list>\n");
        xml.push_str("  <part id=\"P1\">\n");
        xml.push_str("    <measure number=\"1\">\n");
        
        for node in &timeline.events {
            if let EventKind::Note { pitch_midi, .. } = node.kind {
                xml.push_str(&self.generate_note_xml(pitch_midi, node.logical_duration.num, false, false, None, None));
            }
        }
        
        xml.push_str("    </measure>\n");
        xml.push_str("  </part>\n");
        xml.push_str("</score-partwise>\n");
        xml
    }
}
