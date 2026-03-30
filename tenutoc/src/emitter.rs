use crate::ir::{Timeline, EventKind};
use midly::{Smf, Header, Format, Timing, TrackEvent, TrackEventKind, MidiMessage};
use std::collections::BTreeMap;

pub fn to_json(timeline: &Timeline) -> Result<String, String> {
    serde_json::to_string(timeline).map_err(|e| e.to_string())
}

pub fn to_midi(timeline: &Timeline) -> Result<Vec<u8>, String> {
    let ppq = timeline.ppq as u16;
    let mut smf = Smf {
        header: Header::new(Format::SingleTrack, Timing::Metrical(midly::num::u15::new(ppq & 0x7FFF))),
        tracks: Vec::new(),
    };
    
    let mut track = Vec::new();
    
    // We need to order events by absolute tick.
    // Ticks = (num / den) * 4 * PPQ
    let mut events_by_tick: BTreeMap<u32, Vec<TrackEventKind<'static>>> = BTreeMap::new();
    
    for node in &timeline.events {
        if node.track_style == "synth" || node.track_style == "concrete" {
            continue;
        }
        
        match &node.kind {
            EventKind::Note { pitch_midi, velocity, .. } => {
                // Calculate start tick
                let start_tick = ((node.logical_time.num as f64 / node.logical_time.den as f64) * 4.0 * timeline.ppq as f64).round() as u32;
                let duration_ticks = ((node.logical_duration.num as f64 / node.logical_duration.den as f64) * 4.0 * timeline.ppq as f64).round() as u32;
                let end_tick = start_tick + duration_ticks;
                
                events_by_tick.entry(start_tick).or_default().push(TrackEventKind::Midi {
                    channel: midly::num::u4::new(0),
                    message: MidiMessage::NoteOn {
                        key: midly::num::u7::new(*pitch_midi & 0x7F),
                        vel: midly::num::u7::new(*velocity & 0x7F),
                    }
                });
                
                events_by_tick.entry(end_tick).or_default().push(TrackEventKind::Midi {
                    channel: midly::num::u4::new(0),
                    message: MidiMessage::NoteOff {
                        key: midly::num::u7::new(*pitch_midi & 0x7F),
                        vel: midly::num::u7::new(0),
                    }
                });
            }
            _ => {
                // Ignore other event kinds for MIDI
            }
        }
    }
    
    let mut current_tick = 0;
    for (tick, events) in events_by_tick {
        let delta = tick - current_tick;
        for (i, event) in events.into_iter().enumerate() {
            track.push(TrackEvent {
                delta: if i == 0 { midly::num::u28::new(delta & 0x0FFFFFFF) } else { midly::num::u28::new(0) },
                kind: event,
            });
        }
        current_tick = tick;
    }
    
    // Add End of Track
    track.push(TrackEvent {
        delta: midly::num::u28::new(0),
        kind: TrackEventKind::Meta(midly::MetaMessage::EndOfTrack),
    });
    
    smf.tracks.push(track);
    
    let mut buffer = Vec::new();
    smf.write(&mut buffer).map_err(|e| e.to_string())?;
    
    Ok(buffer)
}
