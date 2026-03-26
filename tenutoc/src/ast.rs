use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Ast {
    pub version: String,
    pub imports: Vec<String>,
    pub vars: HashMap<String, String>,
    pub meta: HashMap<String, String>,
    pub defs: Vec<Definition>,
    pub macros: Vec<MacroDef>,
    pub measures: Vec<Measure>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Definition {
    pub id: String,
    pub name: String,
    pub style: String,
    pub patch: String,
    pub group: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub src: Option<String>,
    pub tuning: Option<Vec<i32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MacroDef {
    pub id: String,
    pub events: Vec<Event>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Measure {
    pub number: usize,
    pub meta: Option<HashMap<String, String>>,
    pub parts: Vec<Part>,
    pub markers: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Part {
    pub id: String,
    pub meta: Option<HashMap<String, String>>,
    pub voices: Vec<Voice>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Voice {
    pub id: String,
    pub events: Vec<Event>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum Event {
    #[serde(rename = "note")]
    Note(Note),
    #[serde(rename = "chord")]
    Chord(Chord),
    #[serde(rename = "tuplet")]
    Tuplet(Tuplet),
    #[serde(rename = "macro_call")]
    MacroCall(MacroCall),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Note {
    pub pitch: String,
    pub octave: i32,
    pub accidental: Option<String>,
    pub duration: String,
    pub articulation: Option<String>,
    pub modifiers: Option<Vec<String>>,
    pub cross: Option<String>,
    pub lyric: Option<String>,
    pub push: Option<i32>,
    pub pull: Option<i32>,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Chord {
    pub notes: Vec<Note>,
    pub duration: String,
    pub articulation: Option<String>,
    pub modifiers: Option<Vec<String>>,
    pub cross: Option<String>,
    pub lyric: Option<String>,
    pub push: Option<i32>,
    pub pull: Option<i32>,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Tuplet {
    pub ratio: String,
    pub events: Vec<Event>,
    pub modifiers: Option<Vec<String>>,
    pub cross: Option<String>,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MacroCall {
    pub id: String,
    pub transpose: Option<i32>,
    pub line: usize,
    pub column: usize,
}
