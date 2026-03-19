//! # Deterministic Look-Ahead Scheduler
//!
//! The `tenutod` runtime MUST act as a master sequencer, delegating execution instructions
//! to an external DSP daemon via Open Sound Control (OSC 1.0) over UDP.
//!
//! **TEDP 2.1 Deterministic Look-Ahead Scheduling:**
//! To prevent network jitter from corrupting temporal accuracy, the runtime MUST NOT send
//! OSC messages exactly when they are meant to be heard. All outgoing OSC bundles SHALL
//! include a Network Time Protocol (NTP) timestamp representing an absolute future execution time.

use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::net::UdpSocket;
use rosc::encoder;
use rusty_link::Link;
use tenutoc::ir::Timeline;
use crate::osc_emitter::{encode_superdirt_bundle, encode_chuck_bundle};
use crate::link_sync::LinkSync;

const LOOKAHEAD_MS: u64 = 200; // 200ms look-ahead horizon

pub async fn run_lookahead_loop(
    timeline: Timeline,
    link_state: Arc<Mutex<Link>>,
    superdirt_socket: Arc<UdpSocket>,
    chuck_socket: Arc<UdpSocket>,
) -> Result<(), Box<dyn std::error::Error>> {
    let link_sync = LinkSync::new(link_state, timeline.ppq);
    
    // 1. Flatten the IR Timeline into a Priority Queue of absolute ticks
    let mut event_queue = Vec::new();
    for (track_id, track) in &timeline.tracks {
        for event in &track.events {
            // TEDP 5.3: Micro-Timing & "The Pocket"
            // The physical playback time is shifted by the absolute tick offset.
            let physical_start_tick = (event.tick as i64 + event.physical_tick_offset).max(0) as u64;
            event_queue.push((physical_start_tick, track_id.clone(), track.clone(), event.clone()));
        }
    }
    
    // Sort chronologically by physical start tick
    event_queue.sort_by_key(|(tick, _, _, _)| *tick);

    // 2. The High-Priority Scheduling Loop
    let mut current_event_index = 0;
    let start_time_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_millis() as u64;

    println!("▶️ Playback Started. Dispatching OSC bundles with {}ms look-ahead...", LOOKAHEAD_MS);

    loop {
        if current_event_index >= event_queue.len() {
            println!("⏹️ Playback Complete.");
            break;
        }

        let current_time_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis() as u64;

        // Calculate the absolute horizon
        let horizon_ms = current_time_ms + LOOKAHEAD_MS;

        // Process all events that fall within the look-ahead horizon
        while current_event_index < event_queue.len() {
            let (tick, track_id, track, event) = &event_queue[current_event_index];
            
            // 3. Phase-Locked Rational Grid (TEDP 3.1)
            // Convert the rational tick into absolute microseconds based on the Link phase
            let absolute_micros = link_sync.tick_to_absolute_micros(*tick).await;
            let target_execution_ms = start_time_ms + (absolute_micros / 1000);

            if target_execution_ms <= horizon_ms {
                // Dispatch to SuperDirt
                if track.style == "concrete" || track.style == "synth" || track.style == "grid" {
                    if let Some(bundle) = encode_superdirt_bundle(track_id, track, event, target_execution_ms) {
                        let encoded = encoder::encode(&rosc::OscPacket::Bundle(bundle))?;
                        superdirt_socket.send(&encoded).await?;
                    }
                }
                
                // Dispatch to ChucK
                if track.style == "chuck" {
                    if let Some(bundle) = encode_chuck_bundle(track, event, target_execution_ms) {
                        let encoded = encoder::encode(&rosc::OscPacket::Bundle(bundle))?;
                        chuck_socket.send(&encoded).await?;
                    }
                }

                current_event_index += 1;
            } else {
                // The next event is beyond the horizon, sleep until we need to wake up
                break;
            }
        }

        // Sleep for a short interval (e.g., 10ms) to prevent CPU spinning
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }

    Ok(())
}
