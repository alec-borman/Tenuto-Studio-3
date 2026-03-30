use crate::ir::{Timeline, TimelineNode};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct VisualEvent {
    pub atomic: TimelineNode,
}

#[derive(Debug, Clone)]
pub struct Measure {
    pub number: u32,
    pub start_tick: u32,
    pub end_tick: u32,
    pub events: Vec<VisualEvent>,
}

#[derive(Debug, Clone)]
pub struct Staff {
    pub print: bool,
    pub measures: Vec<Measure>,
}

#[derive(Debug, Clone)]
pub struct VisualScore {
    pub title: String,
    pub staves: HashMap<String, Staff>,
}

impl VisualScore {
    pub fn build(_timeline: &Timeline) -> Self {
        Self {
            title: String::new(),
            staves: HashMap::new(),
        }
    }
}
