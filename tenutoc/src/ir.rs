use crate::spelling::Spelling;
use crate::ast::Ast;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum LyricExtension {
    None,
    Melisma,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteParams {
    pub sample_start: f64,
    pub sample_end: f64,
    pub reverse: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventKind {
    Space,
    Rest,
    Concrete { id: String, key: String, params: ConcreteParams },
    Frequency { hz: f64 },
    Note { spelling: Spelling, pitch_midi: u8, velocity: u8 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtomicEvent {
    pub track_id: String,
    pub track_style: String,
    pub track_patch: String,
    pub track_cut_group: Option<u32>,
    pub tick: u32,
    pub duration_ticks: u32,
    pub physical_tick_offset: i64,
    pub kind: EventKind,
    pub lyric: Option<String>,
    pub lyric_extension: LyricExtension,
    pub synth_accelerate_semitones: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timeline {
    pub ppq: u32,
    pub events: Vec<AtomicEvent>,
}

pub fn compile(_ast: Ast, _debug: bool) -> Result<Timeline, String> {
    Ok(Timeline { ppq: 1920, events: vec![] })
}
