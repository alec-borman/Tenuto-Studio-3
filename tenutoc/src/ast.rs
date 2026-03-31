use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Ast {
    pub version: String,
    pub imports: Vec<String>,
    pub vars: HashMap<String, String>,
    pub meta: HashMap<String, String>,
    pub sustainability: Option<Sustainability>,
    pub defs: Vec<Definition>,
    pub macros: Vec<MacroDef>,
    pub measures: Vec<Measure>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Sustainability {
    pub domain: String,
    pub version: String,
    pub mission: String,
    pub sponsors: Vec<Sponsor>,
    pub roadmap: Vec<Milestone>,
    pub license: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Sponsor {
    pub name: String,
    pub sponsor_type: String, // grant, commercial_license, individual
    pub amount: Option<f64>,
    pub period: String, // YYYY-QQ
    pub status: String, // pending, active, expired
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Milestone {
    pub milestone: String,
    pub date: String, // YYYY-MM-DD
    pub funding_required: Option<f64>,
    pub revenue_target: Option<f64>,
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
    pub map: Option<HashMap<String, Vec<f64>>>,
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
    pub index: Option<u32>,
    pub absolute_start_tick: Option<u64>, // Additive merge boundary
    pub logic: Vec<LogicNode>,
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
pub struct MacroInvocation {
    pub name: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LogicNode {
    EventNode(Event),
    Polyphonic(PolyphonicBlock),
    Assignment(String, Box<LogicNode>), // e.g., vln: c4:4
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PolyphonicBlock {
    pub voices: Vec<Voice>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Rational {
    pub num: u32,
    pub den: u32,
}

pub type PitchLit = String;
pub type Duration = String;
pub type Modifier = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Event {
    Note(PitchLit, Option<Duration>, Vec<Modifier>),
    Chord(Vec<PitchLit>, Option<Duration>, Vec<Modifier>),
    Rest(Option<Duration>),
    Spacer(Option<Duration>, Vec<Modifier>), // The 's' token for invisible automation
    Tuplet(Vec<Event>, Rational),            // Standard Polyrhythm
    Euclidean(PitchLit, u32, u32),           // K hits, N slots e.g., (k):3/8
    MacroCall(MacroInvocation),
}
