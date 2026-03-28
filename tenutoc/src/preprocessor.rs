use crate::ast::{Ast, Event};
use std::collections::HashMap;

pub struct Preprocessor {}

impl Preprocessor {
    pub fn new() -> Self {
        Self {}
    }

    fn calculate_relative_octave(current_octave: i32, current_pitch: &str, new_pitch: &str) -> i32 {
        let mut pitch_classes = HashMap::new();
        pitch_classes.insert("c", 0);
        pitch_classes.insert("d", 2);
        pitch_classes.insert("e", 4);
        pitch_classes.insert("f", 5);
        pitch_classes.insert("g", 7);
        pitch_classes.insert("a", 9);
        pitch_classes.insert("b", 11);

        let current_midi = current_octave * 12 + pitch_classes.get(current_pitch).unwrap_or(&0);
        let new_pitch_class = pitch_classes.get(new_pitch).unwrap_or(&0);

        let mut best_octave = current_octave;
        let mut min_distance = i32::MAX;

        for oct in (current_octave - 1)..=(current_octave + 1) {
            let midi = oct * 12 + new_pitch_class;
            let dist = (midi - current_midi).abs();
            if dist < min_distance {
                min_distance = dist;
                best_octave = oct;
            }
        }
        best_octave
    }

    fn process_events(events: &mut Vec<Event>, style: &str, current_octave: &mut i32, current_pitch: &mut String) {
        for event in events {
            match event {
                Event::Note(note) => {
                    if note.pitch == "r" {
                        if note.octave.is_none() {
                            note.octave = Some(*current_octave);
                        }
                        continue;
                    }
                    if let Some(oct) = note.octave {
                        *current_octave = oct;
                    } else if style == "relative" {
                        *current_octave = Self::calculate_relative_octave(*current_octave, current_pitch, &note.pitch);
                        note.octave = Some(*current_octave);
                    } else {
                        note.octave = Some(*current_octave);
                    }
                    *current_pitch = note.pitch.clone();
                }
                Event::Chord(chord) => {
                    for note in &mut chord.notes {
                        if note.pitch == "r" {
                            if note.octave.is_none() {
                                note.octave = Some(*current_octave);
                            }
                            continue;
                        }
                        if let Some(oct) = note.octave {
                            *current_octave = oct;
                        } else if style == "relative" {
                            *current_octave = Self::calculate_relative_octave(*current_octave, current_pitch, &note.pitch);
                            note.octave = Some(*current_octave);
                        } else {
                            note.octave = Some(*current_octave);
                        }
                        *current_pitch = note.pitch.clone();
                    }
                }
                Event::Tuplet(tuplet) => {
                    Self::process_events(&mut tuplet.events, style, current_octave, current_pitch);
                }
                Event::MacroCall(_) => {}
            }
        }
    }

    fn expand_rolls(events: &mut Vec<Event>) {
        let mut new_events = Vec::new();
        for event in events.drain(..) {
            match event {
                Event::Note(mut note) => {
                    let mut roll_count = 1;
                    if let Some(ref mut mods) = note.modifiers {
                        if let Some(pos) = mods.iter().position(|m| m.starts_with("roll(")) {
                            let roll_mod = mods.remove(pos);
                            if let Some(start) = roll_mod.find('(') {
                                if let Some(end) = roll_mod.find(')') {
                                    if let Ok(count) = roll_mod[start+1..end].parse::<u32>() {
                                        roll_count = count;
                                    }
                                }
                            }
                        }
                        if mods.is_empty() {
                            note.modifiers = None;
                        }
                    }
                    if roll_count > 1 {
                        let mut base_dur = note.duration.clone();
                        let mut dots = 0;
                        while base_dur.ends_with('.') {
                            dots += 1;
                            base_dur.pop();
                        }
                        if let Ok(num) = base_dur.parse::<u32>() {
                            let new_num = num * roll_count;
                            let new_dur = format!("{}{}", new_num, ".".repeat(dots));
                            note.duration = new_dur;
                        }
                        for _ in 0..roll_count {
                            new_events.push(Event::Note(note.clone()));
                        }
                    } else {
                        new_events.push(Event::Note(note));
                    }
                }
                Event::Chord(mut chord) => {
                    let mut roll_count = 1;
                    if let Some(ref mut mods) = chord.modifiers {
                        if let Some(pos) = mods.iter().position(|m| m.starts_with("roll(")) {
                            let roll_mod = mods.remove(pos);
                            if let Some(start) = roll_mod.find('(') {
                                if let Some(end) = roll_mod.find(')') {
                                    if let Ok(count) = roll_mod[start+1..end].parse::<u32>() {
                                        roll_count = count;
                                    }
                                }
                            }
                        }
                        if mods.is_empty() {
                            chord.modifiers = None;
                        }
                    }
                    if roll_count > 1 {
                        let mut base_dur = chord.duration.clone();
                        let mut dots = 0;
                        while base_dur.ends_with('.') {
                            dots += 1;
                            base_dur.pop();
                        }
                        if let Ok(num) = base_dur.parse::<u32>() {
                            let new_num = num * roll_count;
                            let new_dur = format!("{}{}", new_num, ".".repeat(dots));
                            chord.duration = new_dur;
                        }
                        for _ in 0..roll_count {
                            new_events.push(Event::Chord(chord.clone()));
                        }
                    } else {
                        new_events.push(Event::Chord(chord));
                    }
                }
                Event::Tuplet(mut tuplet) => {
                    Self::expand_rolls(&mut tuplet.events);
                    new_events.push(Event::Tuplet(tuplet));
                }
                Event::MacroCall(m) => {
                    new_events.push(Event::MacroCall(m));
                }
            }
        }
        *events = new_events;
    }

    pub fn expand(&mut self, mut ast: Ast) -> Result<Ast, String> {
        let mut part_styles = HashMap::new();
        for def in &ast.defs {
            part_styles.insert(def.id.clone(), def.style.clone());
        }

        let mut current_octave = 4;
        let mut current_pitch = "c".to_string();

        for measure in &mut ast.measures {
            for part in &mut measure.parts {
                let style = part_styles.get(&part.id).map(|s| s.as_str()).unwrap_or("absolute");
                
                for voice in &mut part.voices {
                    Self::process_events(&mut voice.events, style, &mut current_octave, &mut current_pitch);
                    Self::expand_rolls(&mut voice.events);
                }
            }
        }

        Ok(ast)
    }
}
