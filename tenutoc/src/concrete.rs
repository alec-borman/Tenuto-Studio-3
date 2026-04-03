use crate::ast::{Definition, Value};
use crate::ir::{ConcreteParams, EventKind, Rational, TimeVal, TimelineNode};
use std::collections::BTreeMap;

#[derive(Debug, Clone)]
pub struct ConcreteSample {
    pub start: TimeVal,
    pub end: TimeVal,
}

#[derive(Debug, Clone)]
pub struct ConcreteInstrument {
    pub src: String,
    pub map: BTreeMap<String, ConcreteSample>,
}

pub fn parse_concrete_instrument(def: &Definition) -> Option<ConcreteInstrument> {
    if def.style != "concrete" {
        return None;
    }

    let src = def.src.clone()?;
    let mut map = BTreeMap::new();

    if let Some(ref def_map) = def.map {
        for (k, v) in def_map {
            if let Value::Array(ref arr) = v {
                if arr.len() >= 2 {
                    let start = TimeVal::Milliseconds(Rational::new(arr[0].num as i64, arr[0].den as i64));
                    let end = TimeVal::Milliseconds(Rational::new(arr[1].num as i64, arr[1].den as i64));
                    map.insert(k.clone(), ConcreteSample { start, end });
                }
            }
        }
    }

    Some(ConcreteInstrument { src, map })
}

pub fn expand_concrete_events(
    events: Vec<TimelineNode>,
    instruments: &BTreeMap<String, ConcreteInstrument>,
) -> Vec<TimelineNode> {
    let mut expanded = Vec::new();

    for node in events {
        if let EventKind::Concrete { ref id, ref key, ref params } = node.kind {
            if let Some(inst) = instruments.get(id) {
                if let Some(sample) = inst.map.get(key) {
                    let start_ms = match sample.start {
                        TimeVal::Milliseconds(r) => r,
                        _ => Rational::new(0, 1),
                    };
                    let end_ms = match sample.end {
                        TimeVal::Milliseconds(r) => r,
                        _ => Rational::new(0, 1),
                    };

                    if let Some(slices) = params.chop_size {
                        let slice_dur = node.logical_duration / Rational::new(slices as i64, 1);
                        let total_sample_dur = end_ms - start_ms;
                        let sample_slice_dur = total_sample_dur / Rational::new(slices as i64, 1);

                        for i in 0..slices {
                            let mut new_node = node.clone();
                            new_node.logical_time = node.logical_time + (slice_dur * Rational::new(i as i64, 1));
                            new_node.logical_duration = slice_dur;
                            
                            let mut new_params = params.clone();
                            new_params.chop_size = None; 
                            
                            let slice_start_offset = sample_slice_dur * Rational::new(i as i64, 1);
                            let slice_end_offset = sample_slice_dur * Rational::new((i + 1) as i64, 1);
                            
                            if params.reverse {
                                new_params.slice_start = end_ms - slice_end_offset;
                                new_params.slice_end = end_ms - slice_start_offset;
                            } else {
                                new_params.slice_start = start_ms + slice_start_offset;
                                new_params.slice_end = start_ms + slice_end_offset;
                            }
                            
                            new_node.kind = EventKind::Concrete {
                                id: id.clone(),
                                key: key.clone(),
                                params: new_params,
                            };
                            
                            expanded.push(new_node);
                        }
                        continue;
                    } else {
                        let mut new_node = node.clone();
                        let mut new_params = params.clone();
                        
                        if params.reverse {
                            new_params.slice_start = end_ms;
                            new_params.slice_end = start_ms;
                        } else {
                            new_params.slice_start = start_ms;
                            new_params.slice_end = end_ms;
                        }
                        
                        new_node.kind = EventKind::Concrete {
                            id: id.clone(),
                            key: key.clone(),
                            params: new_params,
                        };
                        
                        expanded.push(new_node);
                        continue;
                    }
                }
            }
        }
        
        expanded.push(node);
    }

    expanded
}
