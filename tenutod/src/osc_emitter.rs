//! # OSC Delegation & Networked DSP Orchestration
//!
//! Translates Tenuto IR `AtomicEvent` structures into Open Sound Control (OSC 1.0)
//! bundles with look-ahead scheduling for external synthesis engines.
//!
//! **TEDP 2.2 Standard Address Patterns:**
//! - `/tenuto/play`: Triggers an acoustic or synthetic event.
//! - `/tenuto/param`: Automates continuous control data.
//! - `/tenuto/spawn`: Instantiates a new parallel execution thread (ChucK).

use rosc::{OscMessage, OscPacket, OscType, OscBundle, OscTime};
use tenutoc::ir::{AtomicEvent, EventKind, Track};
use std::time::{SystemTime, UNIX_EPOCH};

/// Converts a Tenuto IR Event into an OSC Bundle with an NTP timestamp for SuperDirt.
pub fn encode_superdirt_bundle(
    track_id: &str, 
    track: &Track, 
    event: &AtomicEvent, 
    execution_time_ms: u64
) -> Option<OscBundle> {
    let mut args = vec![
        OscType::String("s".into()),
        OscType::String(track.patch.clone()),
        OscType::String("sustain".into()),
        OscType::Float((event.duration_ticks as f32) / 1920.0), // Normalized to quarter notes
    ];

    match &event.kind {
        EventKind::Note { pitch_midi, velocity, .. } => {
            args.push(OscType::String("n".into()));
            args.push(OscType::Float(*pitch_midi as f32));
            args.push(OscType::String("gain".into()));
            args.push(OscType::Float(*velocity as f32 / 127.0));
        },
        EventKind::Concrete { key, params } => {
            args.push(OscType::String("begin".into()));
            args.push(OscType::Float(params.sample_start as f32 / 1000.0));
            args.push(OscType::String("end".into()));
            args.push(OscType::Float(params.sample_end as f32 / 1000.0));
            if params.reverse {
                args.push(OscType::String("speed".into()));
                args.push(OscType::Float(-1.0));
            }
        },
        _ => return None, // Rests and Spaces don't trigger OSC
    }

    // Addendum A.2.2: Normative Attribute Mapping
    if let Some(cut_group) = track.cut_group {
        args.push(OscType::String("cut".into()));
        args.push(OscType::Int(cut_group as i32));
    }

    if let Some(glide) = event.synth_accelerate_semitones {
        args.push(OscType::String("accelerate".into()));
        args.push(OscType::Float(glide));
    }

    let msg = OscMessage {
        addr: "/dirt/play".into(),
        args,
    };

    // TEDP 2.1: Deterministic Look-Ahead Scheduling
    // Converts the absolute execution time in milliseconds to an NTP timestamp.
    let ntp_time = ms_to_ntp(execution_time_ms);

    Some(OscBundle {
        timetag: ntp_time,
        content: vec![OscPacket::Message(msg)],
    })
}

/// Converts a Tenuto IR Event into an OSC Bundle for ChucK Shred Spawning.
pub fn encode_chuck_bundle(
    track: &Track, 
    event: &AtomicEvent, 
    execution_time_ms: u64
) -> Option<OscBundle> {
    if track.style != "chuck" { return None; }

    let mut args = vec![
        OscType::String(track.patch.clone()), // The .ck script URI
    ];

    if let EventKind::Note { pitch_midi, velocity, .. } = &event.kind {
        args.push(OscType::Float(*pitch_midi as f32));
        args.push(OscType::Float(*velocity as f32 / 127.0));
    } else {
        return None;
    }

    let msg = OscMessage {
        addr: "/tenuto/spawn".into(),
        args,
    };

    Some(OscBundle {
        timetag: ms_to_ntp(execution_time_ms),
        content: vec![OscPacket::Message(msg)],
    })
}

/// Helper to convert Unix milliseconds to OSC NTP Timetag
fn ms_to_ntp(ms: u64) -> OscTime {
    let seconds = (ms / 1000) as u32;
    let fractional = ((ms % 1000) as f64 / 1000.0 * 4_294_967_296.0) as u32;
    // NTP epoch is 1900, Unix epoch is 1970. Offset is 2,208,988,800 seconds.
    OscTime {
        sec: seconds + 2_208_988_800,
        frac: fractional,
    }
}
