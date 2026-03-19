use midly::{Smf, TrackEventKind, MidiMessage, MetaMessage, Timing};
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct Note {
    start_tick: u32,
    duration: u32,
    pitch: String,
    velocity: u8,
}

pub fn decompile_midi(midi_bytes: &[u8]) -> Result<String, String> {
    let smf = Smf::parse(midi_bytes).map_err(|e| format!("Failed to parse MIDI: {}", e))?;
    
    let ticks_per_beat = match smf.header.timing {
        Timing::Metrical(ticks) => ticks.as_int() as u32,
        _ => 480,
    };

    let mut tempo = 120;
    let mut time_sig = "4/4".to_string();

    for track in &smf.tracks {
        for event in track {
            match event.kind {
                TrackEventKind::Meta(MetaMessage::Tempo(t)) => {
                    tempo = 60_000_000 / t.as_int();
                }
                TrackEventKind::Meta(MetaMessage::TimeSignature(num, den, _, _)) => {
                    time_sig = format!("{}/{}", num, 2_u32.pow(den as u32));
                }
                _ => {}
            }
        }
    }

    let mut tenuto_code = String::new();
    tenuto_code.push_str("tenuto \"3.0\" {\n");
    tenuto_code.push_str(&format!("  meta @{{ title: \"Decompiled Score\", tempo: {}, time: \"{}\" }}\n\n", tempo, time_sig));

    let mut track_defs = Vec::new();
    let mut track_events = Vec::new();

    for (i, track) in smf.tracks.iter().enumerate() {
        let track_id = format!("trk_{}", i);
        let mut is_drum = false;
        let mut current_tick = 0;
        
        let mut active_notes: HashMap<u8, u32> = HashMap::new();
        let mut notes = Vec::new();

        for event in track {
            current_tick += event.delta.as_int();
            match event.kind {
                TrackEventKind::Midi { channel, message } => {
                    if channel == 9 { is_drum = true; }
                    match message {
                        MidiMessage::NoteOn { key, vel } => {
                            let key_val = key.as_int();
                            let vel_val = vel.as_int();
                            if vel_val > 0 {
                                active_notes.insert(key_val, current_tick);
                            } else {
                                if let Some(start) = active_notes.remove(&key_val) {
                                    notes.push(Note {
                                        start_tick: start,
                                        duration: current_tick - start,
                                        pitch: midi_to_pitch(key_val),
                                        velocity: 0,
                                    });
                                }
                            }
                        },
                        MidiMessage::NoteOff { key, .. } => {
                            let key_val = key.as_int();
                            if let Some(start) = active_notes.remove(&key_val) {
                                notes.push(Note {
                                    start_tick: start,
                                    duration: current_tick - start,
                                    pitch: midi_to_pitch(key_val),
                                    velocity: 0,
                                });
                            }
                        },
                        _ => {}
                    }
                },
                _ => {}
            }
        }

        if !notes.is_empty() {
            notes.sort_by_key(|n| n.start_tick);
            let style = if is_drum { "grid" } else { "standard" };
            track_defs.push(format!("  def {} \"Track {}\" style={}\n", track_id, i, style));
            track_events.push((track_id, notes));
        }
    }

    for def in track_defs {
        tenuto_code.push_str(&def);
    }
    tenuto_code.push_str("\n");

    let mut all_macros = Vec::new();
    let mut track_strings = Vec::new();

    for (track_id, notes) in track_events {
        // 1. Quantize and format into tokens
        let tokens = notes_to_tokens(&notes, ticks_per_beat);
        
        // 2. Reverse Bresenham (Euclidean Snapping)
        let euclidean_tokens = apply_reverse_bresenham(tokens);
        
        // 3. LZ77 Macro Extraction
        let (compressed_tokens, _) = extract_lz77_macros(euclidean_tokens, &mut all_macros);
        
        let track_str = format!("    {}: {} |", track_id, compressed_tokens.join(" "));
        track_strings.push(track_str);
    }

    // Print Macros
    for (i, mac) in all_macros.iter().enumerate() {
        tenuto_code.push_str(&format!("  $macro_{} = {{ {} }}\n", i, mac.join(" ")));
    }
    if !all_macros.is_empty() {
        tenuto_code.push_str("\n");
    }

    tenuto_code.push_str("  measure 1 {\n");
    for track_str in track_strings {
        tenuto_code.push_str(&track_str);
        tenuto_code.push_str("\n");
    }
    tenuto_code.push_str("  }\n}\n");

    Ok(tenuto_code)
}

fn midi_to_pitch(midi: u8) -> String {
    let octave = (midi / 12) as i8 - 1;
    let pc = midi % 12;
    let step = match pc {
        0 => "c", 1 => "c#", 2 => "d", 3 => "d#", 4 => "e", 5 => "f",
        6 => "f#", 7 => "g", 8 => "g#", 9 => "a", 10 => "a#", 11 => "b",
        _ => "c",
    };
    format!("{}{}", step, octave)
}

fn notes_to_tokens(notes: &[Note], tpb: u32) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut last_tick = 0;
    let ticks_per_16th = tpb / 4;
    
    for note in notes {
        let mut start = note.start_tick;
        start = ((start as f64 / ticks_per_16th as f64).round() as u32) * ticks_per_16th;
        
        if start > last_tick {
            let rest_ticks = start - last_tick;
            let rest_16ths = rest_ticks / ticks_per_16th;
            for _ in 0..rest_16ths {
                tokens.push("r:16".to_string());
            }
        }
        
        let mut dur = note.duration;
        dur = ((dur as f64 / ticks_per_16th as f64).round() as u32) * ticks_per_16th;
        if dur == 0 { dur = ticks_per_16th; }
        
        let dur_16ths = dur / ticks_per_16th;
        let dur_val = 16.0 / (dur_16ths as f64);
        
        if dur_val.fract() == 0.0 {
            tokens.push(format!("{}:{}", note.pitch, dur_val as u32));
        } else {
            tokens.push(format!("{}:16*{}", note.pitch, dur_16ths));
        }
        
        last_tick = start + dur;
    }
    tokens
}

fn apply_reverse_bresenham(tokens: Vec<String>) -> Vec<String> {
    let mut result = Vec::new();
    let mut i = 0;
    while i < tokens.len() {
        let mut best_match = None;
        
        for n in (3..=32).rev() {
            if i + n > tokens.len() { continue; }
            
            let mut k = 0;
            let mut pitch = None;
            let mut valid = true;
            let mut seq = Vec::new();
            
            for step in 0..n {
                let token = &tokens[i + step];
                if token == "r:16" {
                    seq.push(false);
                } else if token.ends_with(":16") && !token.starts_with("r:") {
                    let p = token.split(':').next().unwrap().to_string();
                    if pitch.is_none() { pitch = Some(p.clone()); }
                    else if pitch.as_deref() != Some(&p) { valid = false; break; }
                    seq.push(true);
                    k += 1;
                } else {
                    valid = false; break;
                }
            }
            
            if valid && k > 1 && k < n {
                let mut is_euclid = true;
                for step in 0..n {
                    let expected_hit = (step * k) % n < k;
                    if seq[step] != expected_hit {
                        is_euclid = false;
                        break;
                    }
                }
                
                if is_euclid {
                    best_match = Some((n, k, pitch.unwrap()));
                    break;
                }
            }
        }
        
        if let Some((n, k, pitch)) = best_match {
            result.push(format!("{}({},{}):16", pitch, k, n));
            i += n;
        } else {
            result.push(tokens[i].clone());
            i += 1;
        }
    }
    result
}

fn extract_lz77_macros(mut tokens: Vec<String>, all_macros: &mut Vec<Vec<String>>) -> (Vec<String>, usize) {
    let mut macro_count = 0;
    
    for len in (2..=32).rev() {
        loop {
            let mut best_seq = None;
            let mut max_count = 1;
            
            let mut counts: HashMap<Vec<String>, usize> = HashMap::new();
            if tokens.len() < len { break; }
            
            let mut i = 0;
            while i <= tokens.len() - len {
                let seq = tokens[i..i+len].to_vec();
                *counts.entry(seq).or_insert(0) += 1;
                i += 1;
            }
            
            for (seq, _) in counts {
                let mut non_overlapping_count = 0;
                let mut j = 0;
                while j <= tokens.len() - len {
                    if tokens[j..j+len] == seq[..] {
                        non_overlapping_count += 1;
                        j += len;
                    } else {
                        j += 1;
                    }
                }
                
                if non_overlapping_count > max_count {
                    max_count = non_overlapping_count;
                    best_seq = Some(seq);
                }
            }
            
            if let Some(seq) = best_seq {
                if max_count >= 2 {
                    let macro_idx = all_macros.len();
                    all_macros.push(seq.clone());
                    
                    let macro_name = format!("$macro_{}", macro_idx);
                    let mut new_tokens = Vec::new();
                    let mut i = 0;
                    while i < tokens.len() {
                        if i + len <= tokens.len() && tokens[i..i+len] == seq[..] {
                            new_tokens.push(macro_name.clone());
                            i += len;
                        } else {
                            new_tokens.push(tokens[i].clone());
                            i += 1;
                        }
                    }
                    tokens = new_tokens;
                    macro_count += 1;
                    continue;
                }
            }
            break;
        }
    }
    
    (tokens, macro_count)
}
