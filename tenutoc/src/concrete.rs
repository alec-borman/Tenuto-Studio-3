use crate::ir::{TimeVal, Rational, EventKind, ConcreteParams, TimelineNode};
use crate::ast::{Definition, Event, Modifier};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ConcreteInstrument {
    pub id: String,
    pub name: String,
    pub src: String,
    pub map: HashMap<String, (f64, f64)>, // key -> (start_sec, end_sec)
}

impl ConcreteInstrument {
    pub fn from_def(def: &Definition) -> Option<Self> {
        if def.style != "concrete" {
            return None;
        }
        let src = def.src.clone()?;
        let mut map = HashMap::new();
        if let Some(def_map) = &def.map {
            for (k, v) in def_map {
                if v.len() >= 2 {
                    map.insert(k.clone(), (v[0], v[1]));
                }
            }
        }
        Some(Self {
            id: def.id.clone(),
            name: def.name.clone(),
            src,
            map,
        })
    }

    pub fn process_event(&self, pitch: &str, dur: Rational, mods: &[String]) -> Vec<(EventKind, Rational)> {
        let mut reverse = false;
        let mut stretch_factor = None;
        let mut chop_size = None;
        let mut slice_n = 1;
        let mut slice_range = None;

        for m in mods {
            if m == ".reverse" {
                reverse = true;
            } else if m.starts_with(".stretch(") && m.ends_with(")") {
                let inner = &m[9..m.len()-1];
                if let Ok(f) = inner.parse::<f64>() {
                    stretch_factor = Some(Rational::new((f * 1000.0).round() as i64, 1000));
                }
            } else if m.starts_with(".chop(") && m.ends_with(")") {
                let inner = &m[6..m.len()-1];
                if let Ok(s) = inner.parse::<f64>() {
                    chop_size = Some(Rational::new((s * 1000.0).round() as i64, 1000));
                }
            } else if m.starts_with(".slice(") && m.ends_with(")") {
                let inner = &m[7..m.len()-1];
                if inner.contains(',') {
                    let parts: Vec<&str> = inner.split(',').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        if let (Ok(start), Ok(end)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                            slice_range = Some((start, end));
                        }
                    }
                } else if let Ok(n) = inner.parse::<u32>() {
                    if n > 0 {
                        slice_n = n;
                    }
                }
            }
        }

        let mut events = Vec::new();
        
        let (mut start_sec, mut end_sec) = self.map.get(pitch).copied().unwrap_or((0.0, 1.0));
        
        if let Some((s, e)) = slice_range {
            start_sec = s;
            end_sec = e;
        }
        
        let start_ms = (start_sec * 1000.0).round() as i64;
        let end_ms = (end_sec * 1000.0).round() as i64;
        
        let sample_dur_ms = end_ms - start_ms;
        let slice_dur_ms = sample_dur_ms / (slice_n as i64);
        let logical_slice_dur = Rational::new(dur.num, dur.den * (slice_n as i64));

        for i in 0..slice_n {
            let s_start = start_ms + (i as i64) * slice_dur_ms;
            let s_end = s_start + slice_dur_ms;
            
            let params = ConcreteParams {
                slice_start: Rational::new(s_start, 1000),
                slice_end: Rational::new(s_end, 1000),
                reverse,
                stretch_factor,
                chop_size,
            };
            
            events.push((
                EventKind::Concrete {
                    id: self.id.clone(),
                    key: pitch.to_string(),
                    params,
                },
                logical_slice_dur
            ));
        }

        events
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_concrete_instrument_parsing() {
        let mut map = HashMap::new();
        map.insert("c4".to_string(), vec![0.0, 1.5]);
        let def = Definition {
            id: "sampler".to_string(),
            name: "My Sampler".to_string(),
            style: "concrete".to_string(),
            patch: "default".to_string(),
            group: None,
            env: None,
            src: Some("audio.wav".to_string()),
            tuning: None,
            map: Some(map),
        };

        let inst = ConcreteInstrument::from_def(&def).unwrap();
        assert_eq!(inst.id, "sampler");
        assert_eq!(inst.src, "audio.wav");
        assert_eq!(inst.map.get("c4"), Some(&(0.0, 1.5)));
    }

    #[test]
    fn test_concrete_slice() {
        let mut map = HashMap::new();
        map.insert("c4".to_string(), vec![0.0, 1.0]); // 1 second sample
        let inst = ConcreteInstrument {
            id: "sampler".to_string(),
            name: "My Sampler".to_string(),
            src: "audio.wav".to_string(),
            map,
        };

        let dur = Rational::new(1, 4); // quarter note
        let mods = vec![".slice(4)".to_string()];
        let events = inst.process_event("c4", dur, &mods);

        assert_eq!(events.len(), 4);
        for (i, (kind, d)) in events.iter().enumerate() {
            assert_eq!(*d, Rational::new(1, 16)); // 1/4 divided by 4
            if let EventKind::Concrete { params, .. } = kind {
                assert_eq!(params.slice_start, Rational::new((i * 250) as i64, 1000));
                assert_eq!(params.slice_end, Rational::new(((i + 1) * 250) as i64, 1000));
                assert_eq!(params.reverse, false);
            } else {
                panic!("Expected Concrete event");
            }
        }
    }

    #[test]
    fn test_concrete_reverse() {
        let mut map = HashMap::new();
        map.insert("c4".to_string(), vec![0.0, 1.0]);
        let inst = ConcreteInstrument {
            id: "sampler".to_string(),
            name: "My Sampler".to_string(),
            src: "audio.wav".to_string(),
            map,
        };

        let dur = Rational::new(1, 4);
        let mods = vec![".reverse".to_string()];
        let events = inst.process_event("c4", dur, &mods);

        assert_eq!(events.len(), 1);
        if let EventKind::Concrete { params, .. } = &events[0].0 {
            assert_eq!(params.reverse, true);
        } else {
            panic!("Expected Concrete event");
        }
    }

    #[test]
    fn test_concrete_stretch_chop() {
        let mut map = HashMap::new();
        map.insert("c4".to_string(), vec![0.0, 1.0]);
        let inst = ConcreteInstrument {
            id: "sampler".to_string(),
            name: "My Sampler".to_string(),
            src: "audio.wav".to_string(),
            map,
        };

        let dur = Rational::new(1, 4);
        let mods = vec![".stretch(1.5)".to_string(), ".chop(0.1)".to_string()];
        let events = inst.process_event("c4", dur, &mods);

        assert_eq!(events.len(), 1);
        if let EventKind::Concrete { params, .. } = &events[0].0 {
            assert_eq!(params.stretch_factor, Some(Rational::new(1500, 1000)));
            assert_eq!(params.chop_size, Some(Rational::new(100, 1000)));
        } else {
            panic!("Expected Concrete event");
        }
    }

    #[test]
    fn test_concrete_slice_range() {
        let mut map = HashMap::new();
        map.insert("c4".to_string(), vec![0.0, 1.0]);
        let inst = ConcreteInstrument {
            id: "sampler".to_string(),
            name: "My Sampler".to_string(),
            src: "audio.wav".to_string(),
            map,
        };

        let dur = Rational::new(1, 4);
        let mods = vec![".slice(0.2, 0.8)".to_string()];
        let events = inst.process_event("c4", dur, &mods);

        assert_eq!(events.len(), 1);
        if let EventKind::Concrete { params, .. } = &events[0].0 {
            assert_eq!(params.slice_start, Rational::new(200, 1000));
            assert_eq!(params.slice_end, Rational::new(800, 1000));
        } else {
            panic!("Expected Concrete event");
        }
    }
}

