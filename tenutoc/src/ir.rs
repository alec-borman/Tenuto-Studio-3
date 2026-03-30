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

fn parse_modifiers(mods: &[String]) -> Option<TimeVal> {
    for m in mods {
        if m.starts_with(".pull(") && m.ends_with(")") {
            let inner = &m[6..m.len()-1];
            if inner.ends_with("ms") {
                if let Ok(val) = inner[..inner.len()-2].parse::<i64>() {
                    return Some(TimeVal::Milliseconds(Rational::new(-val, 1)));
                }
            }
        }
        if m.starts_with(".push(") && m.ends_with(")") {
            let inner = &m[6..m.len()-1];
            if inner.ends_with("ms") {
                if let Ok(val) = inner[..inner.len()-2].parse::<i64>() {
                    return Some(TimeVal::Milliseconds(Rational::new(val, 1)));
                }
            }
        }
    }
    None
}

pub fn compile(ast: Ast, _debug: bool) -> Result<Timeline, String> {
    let mut events = Vec::new();
    
    let mut voice_time: HashMap<(String, String), Rational> = HashMap::new();
    let mut voice_octave: HashMap<(String, String), u8> = HashMap::new();
    let mut voice_duration: HashMap<(String, String), Rational> = HashMap::new();
    let mut voice_velocity: HashMap<(String, String), u8> = HashMap::new();
    
    for measure in ast.measures {
        for part in measure.parts {
            for voice in part.voices {
                let key = (part.id.clone(), voice.id.clone());
                
                let mut current_time = *voice_time.get(&key).unwrap_or(&Rational::new(0, 1));
                let mut last_octave = *voice_octave.get(&key).unwrap_or(&4);
                let mut last_duration = *voice_duration.get(&key).unwrap_or(&Rational::new(1, 4));
                let mut last_velocity = *voice_velocity.get(&key).unwrap_or(&100);
                
                for event in voice.events {
                    match event {
                        crate::ast::Event::Note(pitch, dur_opt, mods) => {
                            let dur = dur_opt.map(|d| parse_duration(&d)).unwrap_or(last_duration);
                            last_duration = dur;
                            
                            let (spelling, midi, new_octave) = parse_pitch(&pitch, last_octave);
                            last_octave = new_octave;
                            
                            let physical_offset = parse_modifiers(&mods);
                            
                            events.push(TimelineNode {
                                track_id: part.id.clone(),
                                track_style: "default".to_string(),
                                track_patch: "default".to_string(),
                                track_cut_group: None,
                                logical_time: current_time,
                                logical_duration: dur,
                                physical_offset,
                                kind: EventKind::Note { spelling, pitch_midi: midi, velocity: last_velocity },
                                lyric: None,
                                lyric_extension: LyricExtension::None,
                                synth_accelerate_semitones: None,
                            });
                            
                            current_time = current_time + dur;
                        }
                        crate::ast::Event::Chord(pitches, dur_opt, mods) => {
                            let dur = dur_opt.map(|d| parse_duration(&d)).unwrap_or(last_duration);
                            last_duration = dur;
                            
                            let physical_offset = parse_modifiers(&mods);
                            
                            for pitch in pitches {
                                let (spelling, midi, new_octave) = parse_pitch(&pitch, last_octave);
                                last_octave = new_octave;
                                
                                events.push(TimelineNode {
                                    track_id: part.id.clone(),
                                    track_style: "default".to_string(),
                                    track_patch: "default".to_string(),
                                    track_cut_group: None,
                                    logical_time: current_time,
                                    logical_duration: dur,
                                    physical_offset: physical_offset.clone(),
                                    kind: EventKind::Note { spelling, pitch_midi: midi, velocity: last_velocity },
                                    lyric: None,
                                    lyric_extension: LyricExtension::None,
                                    synth_accelerate_semitones: None,
                                });
                            }
                            
                            current_time = current_time + dur;
                        }
                        crate::ast::Event::Rest(dur_opt) => {
                            let dur = dur_opt.map(|d| parse_duration(&d)).unwrap_or(last_duration);
                            last_duration = dur;
                            
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
                        crate::ast::Event::Spacer(dur_opt, _) => {
                            let dur = dur_opt.map(|d| parse_duration(&d)).unwrap_or(last_duration);
                            last_duration = dur;
                            
                            events.push(TimelineNode {
                                track_id: part.id.clone(),
                                track_style: "default".to_string(),
                                track_patch: "default".to_string(),
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
                        _ => {}
                    }
                }
                
                voice_time.insert(key.clone(), current_time);
                voice_octave.insert(key.clone(), last_octave);
                voice_duration.insert(key.clone(), last_duration);
                voice_velocity.insert(key, last_velocity);
            }
        }
    }
    
    Ok(Timeline { ppq: 1920, events })
}
