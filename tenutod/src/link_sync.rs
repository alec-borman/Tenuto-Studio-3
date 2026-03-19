//! # Temporal Synchronization (Ableton Link)
//!
//! For live algorithmic performances (Algoraves) and hybrid studio environments,
//! Tenuto MUST support dynamic tempo integration without compromising its internal
//! mathematical exactness.
//!
//! **TEDP 3.1 The Phase-Locked Rational Grid:**
//! The internal AST evaluates rhythms as pure rational fractions (P/Q).
//! The Link Protocol dictates the absolute microsecond duration of a system beat.
//! The runtime performs Just-In-Time (JIT) multiplication of the rational fraction
//! against the Link microsecond phase to determine physical execution.

use std::sync::Arc;
use tokio::sync::Mutex;
use rusty_link::Link;

/// A thread-safe wrapper around the Ableton Link session.
pub struct LinkSync {
    link: Arc<Mutex<Link>>,
    ppq: u32,
}

impl LinkSync {
    pub fn new(link: Arc<Mutex<Link>>, ppq: u32) -> Self {
        Self { link, ppq }
    }

    /// Converts a Tenuto IR rational tick into an absolute physical microsecond timestamp
    /// based on the current Ableton Link session phase and tempo.
    pub async fn tick_to_absolute_micros(&self, tick: u64) -> u64 {
        let link_guard = self.link.lock().await;
        let session_state = link_guard.capture_audio_session_state();
        let current_time = link_guard.clock().micros();
        
        // 1. Get the current tempo from the Link session
        let tempo = session_state.tempo();
        
        // 2. Calculate the duration of a single quarter note in microseconds
        let quarter_note_micros = 60_000_000.0 / tempo;
        
        // 3. Calculate the duration of a single PPQ tick
        let tick_micros = quarter_note_micros / (self.ppq as f64);
        
        // 4. Calculate the absolute microsecond offset from the start of the session
        let absolute_micros = (tick as f64) * tick_micros;
        
        // 5. Add the session start time (derived from the current phase)
        let beat_at_time = session_state.beat_at_time(current_time, 4.0);
        let session_start_time = current_time - (beat_at_time * quarter_note_micros) as u64;
        
        session_start_time + absolute_micros as u64
    }

    /// Returns the current global tempo of the Link session.
    pub async fn current_tempo(&self) -> f64 {
        let link_guard = self.link.lock().await;
        link_guard.capture_audio_session_state().tempo()
    }

    /// TEDP 3.2 Generative Injection (Beat-Matched Evaluation)
    /// If an LLM or live-coder injects new Tenuto source code during active playback,
    /// the runtime MUST wait for the next mathematical downbeat (defined by the Link phase)
    /// before seamlessly appending the compiled IR to the execution queue.
    pub async fn wait_for_next_downbeat(&self) {
        loop {
            let link_guard = self.link.lock().await;
            let state = link_guard.capture_audio_session_state();
            let current_time = link_guard.clock().micros();
            let phase = state.phase_at_time(current_time, 4.0);
            
            // If the phase is extremely close to 0.0 (the downbeat), break the loop
            if phase < 0.05 || phase > 3.95 {
                break;
            }
            
            // Sleep for a short duration to prevent CPU spinning
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    }
}
