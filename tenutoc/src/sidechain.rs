use crate::ir::{Timeline, TimelineNode, EventKind, Rational};
use crate::ast::Ast;
use std::collections::HashMap;

pub fn apply_sidechain(timeline: &mut Timeline, ast: &Ast) {
    // Basic sidechain ducking implementation
    // We'll look for tracks that are sidechained to others and generate CC curves
    
    // Parse sidechain map from AST meta
    let mut sidechain_map = HashMap::new();
    if let Some(serde_json::Value::Object(map)) = ast.meta.get("sidechain") {
        for (target, source_val) in map {
            if let serde_json::Value::String(source) = source_val {
                sidechain_map.insert(target.clone(), source.clone());
            }
        }
    }
    
    let mut sidechain_sources = HashMap::new();
    
    // First pass: find sources
    for node in &timeline.events {
        if let EventKind::Note { .. } = node.kind {
            sidechain_sources.entry(node.track_id.clone()).or_insert_with(Vec::new).push(node.clone());
        }
    }
    
    // Second pass: apply ducking
    let mut new_events = Vec::new();
    for (target, source) in sidechain_map {
        if let Some(source_events) = sidechain_sources.get(&source) {
            for src_event in source_events {
                let steps = 4;
                let step_dur = src_event.logical_duration / Rational::new(steps, 1);
                for i in 0..steps {
                    let value = if i == 0 { 0 } else { (127 * i / (steps - 1)) as u8 };
                    new_events.push(TimelineNode {
                        track_id: target.clone(),
                        voice_id: "sidechain_auto".to_string(),
                        track_style: "automation".to_string(),
                        track_patch: "default".to_string(),
                        track_cut_group: None,
                        logical_time: src_event.logical_time + (step_dur * Rational::new(i, 1)),
                        logical_duration: step_dur,
                        physical_offset: None,
                        kind: EventKind::MidiCC { controller: 11, value },
                        lyric: None,
                        lyric_extension: crate::ir::LyricExtension::None,
                        synth_accelerate_semitones: None,
                        pan: None,
                        orbit: None,
                        fx_chain: Vec::new(),
                    });
                }
            }
        }
    }
    timeline.events.extend(new_events);
}
