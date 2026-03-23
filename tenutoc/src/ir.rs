use crate::spelling::Spelling;
use crate::ast::Ast;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LyricExtension {
    None,
    Melisma,
}

#[derive(Debug, Clone)]
pub enum EventKind {
    Space,
    Rest,
    Concrete { id: String },
    Frequency { hz: f64 },
    Note { spelling: Spelling },
}

#[derive(Debug, Clone)]
pub struct AtomicEvent {
    pub tick: u32,
    pub kind: EventKind,
    pub lyric: Option<String>,
    pub lyric_extension: LyricExtension,
}

#[derive(Debug, Clone)]
pub struct Timeline {
    pub events: Vec<AtomicEvent>,
}

pub fn compile(_ast: Ast, _debug: bool) -> Result<Timeline, String> {
    Ok(Timeline { events: vec![] })
}
