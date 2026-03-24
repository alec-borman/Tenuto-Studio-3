use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AccidentalDisplay {
    Implicit,
    Explicit,
    Cautionary,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
