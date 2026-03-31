use crate::spelling::Spelling;
use crate::ast::Ast;
use serde::{Serialize, Deserialize};

use std::ops::{Add, Sub, Mul, Div};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rational {
    pub num: i64,
    pub den: i64,
}

impl Rational {
    pub fn new(num: i64, den: i64) -> Self {
        let gcd = Self::gcd(num.abs(), den.abs());
        let mut n = num / gcd;
        let mut d = den / gcd;
        if d < 0 {
            n = -n;
            d = -d;
        }
        Self { num: n, den: d }
    }

    fn gcd(mut a: i64, mut b: i64) -> i64 {
        while b != 0 {
            let t = b;
            b = a % b;
            a = t;
        }
        a
    }
}

impl Default for Rational {
    fn default() -> Self {
        Self::new(0, 1)
    }
}

impl Add for Rational {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        Self::new(self.num * rhs.den + rhs.num * self.den, self.den * rhs.den)
    }
}

impl Sub for Rational {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self {
        Self::new(self.num * rhs.den - rhs.num * self.den, self.den * rhs.den)
    }
}

impl Mul for Rational {
    type Output = Self;
    fn mul(self, rhs: Self) -> Self {
        Self::new(self.num * rhs.num, self.den * rhs.den)
    }
}

impl Div for Rational {
    type Output = Self;
    fn div(self, rhs: Self) -> Self {
        Self::new(self.num * rhs.den, self.den * rhs.num)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum LyricExtension {
    None,
    Melisma,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimeVal {
    Milliseconds(Rational),
    Seconds(Rational),
    Ticks(Rational),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteParams {
    pub slice_start: Rational,
    pub slice_end: Rational,
    pub reverse: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdsrEnvelope {
    pub attack: TimeVal,
    pub decay: TimeVal,
    pub sustain: Rational,
    pub release: TimeVal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynthParams {
    pub adsr: AdsrEnvelope,
    pub portamento: Option<TimeVal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventKind {
    Space,
    Rest,
    Concrete { id: String, key: String, params: ConcreteParams },
    Frequency { hz: Rational },
    Note { spelling: Spelling, pitch_midi: u8, velocity: u8 },
    Synth { params: SynthParams },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineNode {
    pub track_id: String,
    pub track_style: String,
    pub track_patch: String,
    pub track_cut_group: Option<u32>,
    pub logical_time: Rational,
    pub logical_duration: Rational,
    pub physical_offset: Option<TimeVal>,
    pub kind: EventKind,
    pub lyric: Option<String>,
    pub lyric_extension: LyricExtension,
    pub synth_accelerate_semitones: Option<Rational>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timeline {
    pub ppq: u32,
    pub events: Vec<TimelineNode>,
}

use std::collections::HashMap;

fn parse_duration(dur: &str) -> Rational {
    let mut dots = 0;
    let mut base_str = String::new();
    for c in dur.chars() {
        if c == '.' {
            dots += 1;
        } else {
            base_str.push(c);
        }
    }
    let base_den: i64 = base_str.parse().unwrap_or(4);
    let mut result = Rational::new(1, base_den);
    let mut add = result;
    for _ in 0..dots {
        add = add * Rational::new(1, 2);
        result = result + add;
    }
    result
}

fn parse_pitch(pitch: &str, last_octave: u8) -> (Spelling, u8, u8) {
    use crate::spelling::{Step, AccidentalDisplay};
    let mut chars = pitch.chars().peekable();
    let step_char = chars.next().unwrap_or('c').to_ascii_lowercase();
    let step = match step_char {
        'c' => Step::C,
        'd' => Step::D,
        'e' => Step::E,
        'f' => Step::F,
        'g' => Step::G,
        'a' => Step::A,
        'b' => Step::B,
        _ => Step::C,
    };
    
    let mut alter: i8 = 0;
    while let Some(&c) = chars.peek() {
        if c == '#' {
            alter += 1;
            chars.next();
        } else if c == 'b' {
            alter -= 1;
            chars.next();
        } else {
            break;
        }
    }
    
    let mut octave_str = String::new();
    while let Some(c) = chars.next() {
        if c.is_ascii_digit() {
            octave_str.push(c);
        }
    }
    
    let octave = if octave_str.is_empty() {
        last_octave
    } else {
        octave_str.parse().unwrap_or(last_octave)
    };
    
    let step_val: i16 = match step {
        Step::C => 0,
        Step::D => 2,
        Step::E => 4,
        Step::F => 5,
        Step::G => 7,
        Step::A => 9,
        Step::B => 11,
    };
    
    let midi = ((octave as i16 + 1) * 12 + step_val + alter as i16).clamp(0, 127) as u8;
    
    let spelling = Spelling {
        step,
        octave,
        alter,
        display: AccidentalDisplay::Implicit,
    };
    
    (spelling, midi, octave)
}

fn parse_modifiers(mods: &[String]) -> (Option<TimeVal>, bool, Option<Rational>) {
    let mut physical_offset = None;
    let mut reverse = false;
    let mut accelerate = None;

    for m in mods {
        if m.starts_with(".pull(") && m.ends_with(")") {
            let inner = &m[6..m.len()-1];
            if inner.ends_with("ms") {
                if let Ok(val) = inner[..inner.len()-2].parse::<i64>() {
                    physical_offset = Some(TimeVal::Milliseconds(Rational::new(-val, 1)));
                }
            }
        } else if m.starts_with(".push(") && m.ends_with(")") {
            let inner = &m[6..m.len()-1];
            if inner.ends_with("ms") {
                if let Ok(val) = inner[..inner.len()-2].parse::<i64>() {
                    physical_offset = Some(TimeVal::Milliseconds(Rational::new(val, 1)));
                }
            }
        } else if m == ".reverse" {
            reverse = true;
        } else if m.starts_with(".accelerate(") && m.ends_with(")") {
            let inner = &m[12..m.len()-1];
            if let Ok(val) = inner.parse::<i64>() {
                accelerate = Some(Rational::new(val, 1));
            }
        }
    }
    (physical_offset, reverse, accelerate)
}

use crate::cursor::Cursor;

pub fn compile(ast: Ast, _debug: bool) -> Result<Timeline, String> {
    let mut events = Vec::new();
    
    let mut defs_map = HashMap::new();
    for def in ast.defs {
        defs_map.insert(def.id.clone(), def);
    }
    
    let mut voice_time: HashMap<(String, String), Rational> = HashMap::new();
    let mut voice_cursors: HashMap<(String, String), Cursor> = HashMap::new();
    
    for measure in ast.measures {
        for part in measure.parts {
            for voice in part.voices {
                let key = (part.id.clone(), voice.id.clone());
                
                let mut current_time = *voice_time.get(&key).unwrap_or(&Rational::new(0, 1));
                let mut cursor = voice_cursors.get(&key).cloned().unwrap_or_else(|| Cursor::new());
                
                for event in voice.events {
                    match event {
                        crate::ast::Event::Note(pitch, dur_opt, mods) => {
                            let dur = dur_opt.map(|d| parse_duration(&d)).unwrap_or(cursor.last_duration);
                            cursor.last_duration = dur;
                            
                            let (spelling, midi, new_octave) = parse_pitch(&pitch, cursor.last_octave as u8);
                            cursor.last_octave = new_octave as i8;
                            
                            let (physical_offset, _reverse, accelerate) = parse_modifiers(&mods);
                            
                            let track_style = defs_map.get(&part.id).map(|d| d.style.clone()).unwrap_or_else(|| "default".to_string());
                            let track_patch = defs_map.get(&part.id).map(|d| d.patch.clone()).unwrap_or_else(|| "default".to_string());
                            
                            let kind = if track_patch == "engine:concrete_audio" {
                                EventKind::Concrete {
                                    id: part.id.clone(),
                                    key: pitch.clone(),
                                    params: ConcreteParams {
                                        slice_start: Rational::new(0, 1),
                                        slice_end: dur,
                                        reverse: _reverse,
                                    }
                                }
                            } else {
                                EventKind::Note { spelling, pitch_midi: midi, velocity: cursor.last_velocity }
                            };
                            
                            events.push(TimelineNode {
                                track_id: part.id.clone(),
                                track_style,
                                track_patch,
                                track_cut_group: None,
                                logical_time: current_time,
                                logical_duration: dur,
                                physical_offset,
                                kind,
                                lyric: None,
                                lyric_extension: LyricExtension::None,
                                synth_accelerate_semitones: accelerate,
                            });
                            
                            current_time = current_time + dur;
                        }
                        crate::ast::Event::Chord(pitches, dur_opt, mods) => {
                            let dur = dur_opt.map(|d| parse_duration(&d)).unwrap_or(cursor.last_duration);
                            cursor.last_duration = dur;
                            
                            let (physical_offset, _reverse, accelerate) = parse_modifiers(&mods);
                            
                            let track_style = defs_map.get(&part.id).map(|d| d.style.clone()).unwrap_or_else(|| "default".to_string());
                            let track_patch = defs_map.get(&part.id).map(|d| d.patch.clone()).unwrap_or_else(|| "default".to_string());
                            
                            for pitch in pitches {
                                let (spelling, midi, new_octave) = parse_pitch(&pitch, cursor.last_octave as u8);
                                cursor.last_octave = new_octave as i8;
                                
                                let kind = if track_patch == "engine:concrete_audio" {
                                    EventKind::Concrete {
                                        id: part.id.clone(),
                                        key: pitch.clone(),
                                        params: ConcreteParams {
                                            slice_start: Rational::new(0, 1),
                                            slice_end: dur,
                                            reverse: _reverse,
                                        }
                                    }
                                } else {
                                    EventKind::Note { spelling, pitch_midi: midi, velocity: cursor.last_velocity }
                                };
                                
                                events.push(TimelineNode {
                                    track_id: part.id.clone(),
                                    track_style: track_style.clone(),
                                    track_patch: track_patch.clone(),
                                    track_cut_group: None,
                                    logical_time: current_time,
                                    logical_duration: dur,
                                    physical_offset: physical_offset.clone(),
                                    kind,
                                    lyric: None,
                                    lyric_extension: LyricExtension::None,
                                    synth_accelerate_semitones: accelerate,
                                });
                            }
                            
                            current_time = current_time + dur;
                        }
                        crate::ast::Event::Rest(dur_opt) => {
                            let dur = dur_opt.map(|d| parse_duration(&d)).unwrap_or(cursor.last_duration);
                            cursor.last_duration = dur;
                            
                            let track_style = defs_map.get(&part.id).map(|d| d.style.clone()).unwrap_or_else(|| "default".to_string());
                            let track_patch = defs_map.get(&part.id).map(|d| d.patch.clone()).unwrap_or_else(|| "default".to_string());
                            
                            events.push(TimelineNode {
                                track_id: part.id.clone(),
                                track_style,
                                track_patch,
                                track_cut_group: None,
                                logical_time: current_time,
                                logical_duration: dur,
                                physical_offset: None,
                                kind: EventKind::Rest,
                                lyric: None,
                                lyric_extension: LyricExtension::None,
                                synth_accelerate_semitones: None,
                            });
                            
                            current_time = current_time + dur;
                        }
                        crate::ast::Event::Spacer(dur_opt, _) => {
                            let dur = dur_opt.map(|d| parse_duration(&d)).unwrap_or(cursor.last_duration);
                            cursor.last_duration = dur;
                            
                            let track_style = defs_map.get(&part.id).map(|d| d.style.clone()).unwrap_or_else(|| "default".to_string());
                            let track_patch = defs_map.get(&part.id).map(|d| d.patch.clone()).unwrap_or_else(|| "default".to_string());
                            
                            events.push(TimelineNode {
                                track_id: part.id.clone(),
                                track_style,
                                track_patch,
                                track_cut_group: None,
                                logical_time: current_time,
                                logical_duration: dur,
                                physical_offset: None,
                                kind: EventKind::Space,
                                lyric: None,
                                lyric_extension: LyricExtension::None,
                                synth_accelerate_semitones: None,
                            });
                            
                            current_time = current_time + dur;
                        }
                        crate::ast::Event::Euclidean(pitch, k, n) => {
                            let dur = cursor.last_duration;
                            let slot_dur = dur / Rational::new(n as i64, 1);
                            
                            let (spelling, midi, new_octave) = parse_pitch(&pitch, cursor.last_octave as u8);
                            cursor.last_octave = new_octave as i8;
                            
                            let pattern = crate::euclidean::euclidean(*k, *n);
                            
                            let track_style = defs_map.get(&part.id).map(|d| d.style.clone()).unwrap_or_else(|| "default".to_string());
                            let track_patch = defs_map.get(&part.id).map(|d| d.patch.clone()).unwrap_or_else(|| "default".to_string());
                            
                            for (i, hit) in pattern.iter().enumerate() {
                                if *hit {
                                    let kind = if track_patch == "engine:concrete_audio" {
                                        EventKind::Concrete {
                                            id: part.id.clone(),
                                            key: pitch.clone(),
                                            params: ConcreteParams {
                                                slice_start: Rational::new(0, 1),
                                                slice_end: slot_dur,
                                                reverse: false,
                                            }
                                        }
                                    } else {
                                        EventKind::Note { spelling: spelling.clone(), pitch_midi: midi, velocity: cursor.last_velocity }
                                    };
                                    
                                    events.push(TimelineNode {
                                        track_id: part.id.clone(),
                                        track_style: track_style.clone(),
                                        track_patch: track_patch.clone(),
                                        track_cut_group: None,
                                        logical_time: current_time + (slot_dur * Rational::new(i as i64, 1)),
                                        logical_duration: slot_dur,
                                        physical_offset: None,
                                        kind,
                                        lyric: None,
                                        lyric_extension: LyricExtension::None,
                                        synth_accelerate_semitones: None,
                                    });
                                }
                            }
                            current_time = current_time + dur;
                        }
                        crate::ast::Event::MacroCall(invocation) => {
                            // MacroCall is not yet implemented in IR
                        }
                        crate::ast::Event::Tuplet(events_in_tuplet, ratio) => {
                            let total_dur = cursor.last_duration;
                            let tuplet_factor = Rational::new(ratio.den as i64, ratio.num as i64);
                            
                            for event in events_in_tuplet {
                                match event {
                                    crate::ast::Event::Note(pitch, dur_opt, mods) => {
                                        let base_dur = dur_opt.as_ref().map(|d| parse_duration(d)).unwrap_or(cursor.last_duration);
                                        let dur = base_dur * tuplet_factor;
                                        cursor.last_duration = base_dur; // Keep base duration for next event
                                        
                                        let (spelling, midi, new_octave) = parse_pitch(pitch, cursor.last_octave as u8);
                                        cursor.last_octave = new_octave as i8;
                                        
                                        let (physical_offset, _reverse, accelerate) = parse_modifiers(mods);
                                        
                                        let track_style = defs_map.get(&part.id).map(|d| d.style.clone()).unwrap_or_else(|| "default".to_string());
                                        let track_patch = defs_map.get(&part.id).map(|d| d.patch.clone()).unwrap_or_else(|| "default".to_string());
                                        
                                        let kind = if track_patch == "engine:concrete_audio" {
                                            EventKind::Concrete {
                                                id: part.id.clone(),
                                                key: pitch.clone(),
                                                params: ConcreteParams {
                                                    slice_start: Rational::new(0, 1),
                                                    slice_end: dur,
                                                    reverse: _reverse,
                                                }
                                            }
                                        } else {
                                            EventKind::Note { spelling, pitch_midi: midi, velocity: cursor.last_velocity }
                                        };
                                        
                                        events.push(TimelineNode {
                                            track_id: part.id.clone(),
                                            track_style,
                                            track_patch,
                                            track_cut_group: None,
                                            logical_time: current_time,
                                            logical_duration: dur,
                                            physical_offset,
                                            kind,
                                            lyric: None,
                                            lyric_extension: LyricExtension::None,
                                            synth_accelerate_semitones: accelerate,
                                        });
                                        
                                        current_time = current_time + dur;
                                    }
                                    crate::ast::Event::Rest(dur_opt) => {
                                        let base_dur = dur_opt.as_ref().map(|d| parse_duration(d)).unwrap_or(cursor.last_duration);
                                        let dur = base_dur * tuplet_factor;
                                        cursor.last_duration = base_dur;
                                        
                                        events.push(TimelineNode {
                                            track_id: part.id.clone(),
                                            track_style: "default".to_string(),
                                            track_patch: "default".to_string(),
                                            track_cut_group: None,
                                            logical_time: current_time,
                                            logical_duration: dur,
                                            physical_offset: None,
                                            kind: EventKind::Rest,
                                            lyric: None,
                                            lyric_extension: LyricExtension::None,
                                            synth_accelerate_semitones: None,
                                        });
                                        
                                        current_time = current_time + dur;
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                }
                
                voice_time.insert(key.clone(), current_time);
                voice_cursors.insert(key.clone(), cursor);
            }
        }
    }
    
    Ok(Timeline { ppq: 1920, events })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rational_new() {
        let r = Rational::new(2, 4);
        assert_eq!(r.num, 1);
        assert_eq!(r.den, 2);

        let r2 = Rational::new(3, -6);
        assert_eq!(r2.num, -1);
        assert_eq!(r2.den, 2);
    }

    #[test]
    fn test_rational_add() {
        let r1 = Rational::new(1, 4);
        let r2 = Rational::new(1, 4);
        let r3 = r1 + r2;
        assert_eq!(r3.num, 1);
        assert_eq!(r3.den, 2);
    }

    #[test]
    fn test_rational_sub() {
        let r1 = Rational::new(1, 2);
        let r2 = Rational::new(1, 4);
        let r3 = r1 - r2;
        assert_eq!(r3.num, 1);
        assert_eq!(r3.den, 4);
    }

    #[test]
    fn test_rational_mul() {
        let r1 = Rational::new(1, 2);
        let r2 = Rational::new(3, 4);
        let r3 = r1 * r2;
        assert_eq!(r3.num, 3);
        assert_eq!(r3.den, 8);
    }

    #[test]
    fn test_rational_div() {
        let r1 = Rational::new(1, 2);
        let r2 = Rational::new(3, 4);
        let r3 = r1 / r2;
        assert_eq!(r3.num, 2);
        assert_eq!(r3.den, 3);
    }
}
