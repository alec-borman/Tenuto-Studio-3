// MusicXML export
use crate::ir::{Timeline, TimelineNode, EventKind, Rational};
use crate::spelling::{AccidentalStateMachine, AccidentalDisplay, Step};
use std::collections::{BTreeMap, HashMap};

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

    pub fn generate_note_xml(&mut self, midi_pitch: u8, duration: u32, is_tie_start: bool, is_tie_stop: bool, voice: &str) -> String {
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
        xml.push_str("      <note>\n");
        xml.push_str("        <pitch>\n");
        xml.push_str(&format!("          <step>{}</step>\n", step_str));
        if spelling.alter != 0 {
            xml.push_str(&format!("          <alter>{}</alter>\n", spelling.alter));
        }
        xml.push_str(&format!("          <octave>{}</octave>\n", spelling.octave));
        xml.push_str("        </pitch>\n");
        xml.push_str(&format!("        <duration>{}</duration>\n", duration));
        
        // Extract voice number from "v1", "v2", etc. Default to 1.
        let voice_num = voice.chars().filter(|c| c.is_ascii_digit()).collect::<String>().parse::<u32>().unwrap_or(1);
        xml.push_str(&format!("        <voice>{}</voice>\n", voice_num));

        if is_tie_stop {
            xml.push_str("        <tie type=\"stop\"/>\n");
        }
        if is_tie_start {
            xml.push_str("        <tie type=\"start\"/>\n");
        }

        if spelling.display == AccidentalDisplay::Explicit {
            let accidental_str = match spelling.alter {
                1 => "sharp",
                0 => "natural",
                -1 => "flat",
                _ => "",
            };
            if !accidental_str.is_empty() {
                xml.push_str(&format!("        <accidental>{}</accidental>\n", accidental_str));
            }
        }

        if is_tie_start || is_tie_stop {
            xml.push_str("        <notations>\n");
            if is_tie_stop {
                xml.push_str("          <tied type=\"stop\"/>\n");
            }
            if is_tie_start {
                xml.push_str("          <tied type=\"start\"/>\n");
            }
            xml.push_str("        </notations>\n");
        }

        xml.push_str("      </note>\n");
        xml
    }

    pub fn generate_rest_xml(&mut self, duration: u32, voice: &str) -> String {
        let mut xml = String::new();
        xml.push_str("      <note>\n");
        xml.push_str("        <rest/>\n");
        xml.push_str(&format!("        <duration>{}</duration>\n", duration));
        let voice_num = voice.chars().filter(|c| c.is_ascii_digit()).collect::<String>().parse::<u32>().unwrap_or(1);
        xml.push_str(&format!("        <voice>{}</voice>\n", voice_num));
        xml.push_str("      </note>\n");
        xml
    }

    pub fn export_timeline(&mut self, timeline: &Timeline) -> String {
        let mut xml = String::new();
        xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n");
        xml.push_str("<!DOCTYPE score-partwise PUBLIC \"-//Recordare//DTD MusicXML 4.0 Partwise//EN\" \"http://www.musicxml.org/dtds/partwise.dtd\">\n");
        xml.push_str("<score-partwise version=\"4.0\">\n");
        xml.push_str("  <part-list>\n");
        
        // Find all unique tracks
        let mut tracks = Vec::new();
        for node in &timeline.events {
            if !tracks.contains(&node.track_id) {
                tracks.push(node.track_id.clone());
            }
        }
        
        if tracks.is_empty() {
            tracks.push("P1".to_string());
        }
        
        for track_id in &tracks {
            xml.push_str(&format!("    <score-part id=\"{}\">\n", track_id));
            xml.push_str(&format!("      <part-name>{}</part-name>\n", track_id));
            xml.push_str("    </score-part>\n");
        }
        xml.push_str("  </part-list>\n");
        
        let ppq = timeline.ppq as u32;
        let measure_duration_ticks = ppq * 4; // Assuming 4/4 time for simplicity
        
        for track_id in &tracks {
            xml.push_str(&format!("  <part id=\"{}\">\n", track_id));
            
            // Group events by voice
            let mut voice_events: HashMap<String, Vec<TimelineNode>> = HashMap::new();
            for node in &timeline.events {
                if node.track_id == *track_id {
                    voice_events.entry(node.voice_id.clone()).or_default().push(node.clone());
                }
            }
            
            // Sort voices to ensure deterministic output
            let mut voices: Vec<String> = voice_events.keys().cloned().collect();
            voices.sort();
            
            let max_tick = voices.iter().flat_map(|v| voice_events.get(v).unwrap().iter().map(|n| {
                let start_tick = ((n.logical_time.num as f64 / n.logical_time.den as f64) * 4.0 * ppq as f64).round() as u32;
                let duration_ticks = ((n.logical_duration.num as f64 / n.logical_duration.den as f64) * 4.0 * ppq as f64).round() as u32;
                start_tick + duration_ticks
            })).max().unwrap_or(0);
            
            let num_measures = (max_tick + measure_duration_ticks - 1) / measure_duration_ticks;
            let num_measures = if num_measures == 0 { 1 } else { num_measures };
            
            for measure_idx in 0..num_measures {
                let measure_start = measure_idx * measure_duration_ticks;
                let measure_end = measure_start + measure_duration_ticks;
                
                xml.push_str(&format!("    <measure number=\"{}\">\n", measure_idx + 1));
                if measure_idx == 0 {
                    xml.push_str("      <attributes>\n");
                    xml.push_str(&format!("        <divisions>{}</divisions>\n", ppq));
                    xml.push_str("        <time>\n");
                    xml.push_str("          <beats>4</beats>\n");
                    xml.push_str("          <beat-type>4</beat-type>\n");
                    xml.push_str("        </time>\n");
                    xml.push_str("      </attributes>\n");
                }
                
                let mut is_first_voice = true;
                
                for voice in &voices {
                    if !is_first_voice {
                        xml.push_str("      <backup>\n");
                        xml.push_str(&format!("        <duration>{}</duration>\n", measure_duration_ticks));
                        xml.push_str("      </backup>\n");
                    }
                    is_first_voice = false;
                    
                    let events = voice_events.get(voice).unwrap();
                    let mut current_tick = measure_start;
                    
                    for node in events {
                        let start_tick = ((node.logical_time.num as f64 / node.logical_time.den as f64) * 4.0 * ppq as f64).round() as u32;
                        let duration_ticks = ((node.logical_duration.num as f64 / node.logical_duration.den as f64) * 4.0 * ppq as f64).round() as u32;
                        let end_tick = start_tick + duration_ticks;
                        
                        // Check if event overlaps with current measure
                        if start_tick < measure_end && end_tick > measure_start {
                            let event_start_in_measure = std::cmp::max(start_tick, measure_start);
                            let event_end_in_measure = std::cmp::min(end_tick, measure_end);
                            
                            if event_start_in_measure > current_tick {
                                let dur = event_start_in_measure - current_tick;
                                xml.push_str("      <forward>\n");
                                xml.push_str(&format!("        <duration>{}</duration>\n", dur));
                                xml.push_str("      </forward>\n");
                                current_tick = event_start_in_measure;
                            }
                            
                            let slice_duration = event_end_in_measure - event_start_in_measure;
                            let is_tie_start = end_tick > measure_end;
                            let is_tie_stop = start_tick < measure_start;
                            
                            match &node.kind {
                                EventKind::Note { pitch_midi, .. } => {
                                    xml.push_str(&self.generate_note_xml(*pitch_midi, slice_duration, is_tie_start, is_tie_stop, voice));
                                }
                                EventKind::Rest => {
                                    xml.push_str(&self.generate_rest_xml(slice_duration, voice));
                                }
                                _ => {}
                            }
                            
                            current_tick += slice_duration;
                        }
                    }
                    
                    if current_tick < measure_end {
                        let dur = measure_end - current_tick;
                        xml.push_str("      <forward>\n");
                        xml.push_str(&format!("        <duration>{}</duration>\n", dur));
                        xml.push_str("      </forward>\n");
                    } else {
                        xml.push_str("      <forward>\n");
                        xml.push_str("        <duration>0</duration>\n");
                        xml.push_str("      </forward>\n");
                    }
                }
                
                xml.push_str("    </measure>\n");
            }
            xml.push_str("  </part>\n");
        }
        
        xml.push_str("</score-partwise>\n");
        xml
    }
}

pub fn to_musicxml(timeline: &Timeline) -> Result<String, String> {
    let mut emitter = XmlEmitter::new(0);
    Ok(emitter.export_timeline(timeline))
}
