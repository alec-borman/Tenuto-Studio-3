use midly::{Smf, TrackEventKind, MidiMessage, MetaMessage, Timing};
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct Note {
    start_tick: u32,
    duration: u32,
    pitch: String,
    velocity: u8,
}

fn unswing_tick(tick: u32, tpb: u32, is_16th: bool) -> u32 {
    let period = if is_16th { tpb / 2 } else { tpb };
    let b = tick / period;
    let r = tick % period;
    let swing_point = period * 2 / 3;
    let mid_point = period / 2;
    
    let new_r = if r <= swing_point {
        (r as f64 * (mid_point as f64 / swing_point as f64)).round() as u32
    } else {
        let fraction = (r - swing_point) as f64 / (period - swing_point) as f64;
        mid_point + (fraction * (period - mid_point) as f64).round() as u32
    };
    b * period + new_r
}

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

fn get_token_duration(token: &str, tpb: u32, macros: &[Vec<String>]) -> u32 {
    let ticks_per_16th = tpb / 4;
    
    if token.starts_with("$macro_") {
        if let Some(idx) = token.find('_') {
            let num_str = token[idx+1..].chars().take_while(|c| c.is_digit(10)).collect::<String>();
            if let Ok(m_idx) = num_str.parse::<usize>() {
                if let Some(mac) = macros.get(m_idx) {
                    let mut sum = 0;
                    for t in mac {
                        sum += get_token_duration(t, tpb, macros);
                    }
                    return sum;
                }
            }
        }
    }
    
    if let Some(idx) = token.find('(') {
        if let Some(idx2) = token.find(')') {
            let inner = &token[idx+1..idx2];
            let parts: Vec<&str> = inner.split(',').collect();
            if parts.len() == 2 {
                if let Ok(n) = parts[1].parse::<u32>() {
                    return n * ticks_per_16th;
                }
            }
        }
    }
    
    let parts: Vec<&str> = token.split(':').collect();
    if parts.len() == 2 {
        let dur_part = parts[1];
        if dur_part.contains('*') {
            let sub_parts: Vec<&str> = dur_part.split('*').collect();
            let base = sub_parts[0].parse::<u32>().unwrap_or(16);
            let mult = sub_parts[1].parse::<u32>().unwrap_or(1);
            return (16 / base) * ticks_per_16th * mult;
        } else {
            let base = dur_part.parse::<u32>().unwrap_or(16);
            return (16 / base) * ticks_per_16th;
        }
    }
    ticks_per_16th
}

fn group_into_measures(tokens: Vec<String>, tpb: u32, ts_num: u32, ts_den: u32, macros: &[Vec<String>]) -> Vec<Vec<String>> {
    let ticks_per_measure = ts_num * tpb * 4 / ts_den;
    let mut measures = Vec::new();
    let mut current_measure = Vec::new();
    let mut current_ticks = 0;
    
    for token in tokens {
        let dur = get_token_duration(&token, tpb, macros);
        current_measure.push(token);
        current_ticks += dur;
        if current_ticks >= ticks_per_measure {
            measures.push(current_measure);
            current_measure = Vec::new();
            current_ticks = 0;
        }
    }
    if !current_measure.is_empty() {
        measures.push(current_measure);
    }
    measures
}

fn hash_measure(measure: &[String]) -> u64 {
    let mut s = DefaultHasher::new();
    let (norm, _) = normalize_sequence(measure);
    norm.join(" ").hash(&mut s);
    s.finish()
}

fn collapse_repeats(measures: Vec<Vec<String>>) -> Vec<String> {
    let mut hashes = Vec::new();
    let mut offsets = Vec::new();
    for m in &measures {
        let mut s = DefaultHasher::new();
        let (norm, offset) = normalize_sequence(m);
        norm.join(" ").hash(&mut s);
        hashes.push(s.finish());
        offsets.push(offset);
    }
    
    let mut result = Vec::new();
    let mut i = 0;
    while i < measures.len() {
        let mut best_len = 0;
        let mut best_repeats = 1;
        
        for len in 1..=(measures.len() - i) / 2 {
            let block_hash = &hashes[i..i+len];
            let block_offset = &offsets[i..i+len];
            let mut repeats = 1;
            let mut j = i + len;
            while j + len <= measures.len() {
                if &hashes[j..j+len] == block_hash && &offsets[j..j+len] == block_offset {
                    repeats += 1;
                    j += len;
                } else {
                    break;
                }
            }
            if repeats > 1 && len * repeats > best_len * best_repeats {
                best_len = len;
                best_repeats = repeats;
            }
        }
        
        if best_repeats > 1 {
            let mut block_tokens = Vec::new();
            for m in &measures[i..i+best_len] {
                block_tokens.extend(m.clone());
            }
            result.push(format!("repeat {} {{ {} }}", best_repeats, block_tokens.join(" ")));
            i += best_len * best_repeats;
        } else {
            result.extend(measures[i].clone());
            i += 1;
        }
    }
    result
}

pub fn decompile_midi(midi_bytes: &[u8]) -> Result<String, String> {
    let smf = Smf::parse(midi_bytes).map_err(|e| format!("Failed to parse MIDI: {}", e))?;
    
    let ticks_per_beat = match smf.header.timing {
        Timing::Metrical(ticks) => ticks.as_int() as u32,
        _ => 480,
    };

    let mut tempo = 120;
    let mut time_sig = "4/4".to_string();
    let mut ts_num = 4;
    let mut ts_den = 4;

    for track in &smf.tracks {
        for event in track {
            match event.kind {
                TrackEventKind::Meta(MetaMessage::Tempo(t)) => {
                    tempo = 60_000_000 / t.as_int();
                }
                TrackEventKind::Meta(MetaMessage::TimeSignature(num, den, _, _)) => {
                    time_sig = format!("{}/{}", num, 2_u32.pow(den as u32));
                    ts_num = num as u32;
                    ts_den = 2_u32.pow(den as u32);
                }
                _ => {}
            }
        }
    }

    let mut track_defs = Vec::new();
    let mut track_events = Vec::new();

    let mut swung_8ths = 0;
    let mut straight_8ths = 0;
    let mut swung_16ths = 0;
    let mut straight_16ths = 0;

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
            
            for note in &notes {
                let r_beat = note.start_tick % ticks_per_beat;
                let diff_straight_8th = (r_beat as i32 - (ticks_per_beat / 2) as i32).abs();
                let diff_swung_8th = (r_beat as i32 - (ticks_per_beat * 2 / 3) as i32).abs();
                
                if diff_swung_8th < diff_straight_8th && diff_swung_8th < (ticks_per_beat / 12) as i32 {
                    swung_8ths += 1;
                } else if diff_straight_8th <= diff_swung_8th && diff_straight_8th < (ticks_per_beat / 12) as i32 {
                    straight_8ths += 1;
                }
                
                let r_half_beat = note.start_tick % (ticks_per_beat / 2);
                let diff_straight_16th = (r_half_beat as i32 - (ticks_per_beat / 4) as i32).abs();
                let diff_swung_16th = (r_half_beat as i32 - (ticks_per_beat / 3) as i32).abs();
                
                if diff_swung_16th < diff_straight_16th && diff_swung_16th < (ticks_per_beat / 24) as i32 {
                    swung_16ths += 1;
                } else if diff_straight_16th <= diff_swung_16th && diff_straight_16th < (ticks_per_beat / 24) as i32 {
                    straight_16ths += 1;
                }
            }
            
            let style = if is_drum { "grid" } else { "standard" };
            track_defs.push(format!("  def {} \"Track {}\" style={}\n", track_id, i, style));
            track_events.push((track_id, notes));
        }
    }

    let mut has_8th_swing = false;
    let mut has_16th_swing = false;
    
    if swung_8ths > straight_8ths * 2 && swung_8ths > 3 {
        has_8th_swing = true;
    } else if swung_16ths > straight_16ths * 2 && swung_16ths > 3 {
        has_16th_swing = true;
    }

    let has_swing = has_8th_swing || has_16th_swing;

    let mut tenuto_code = String::new();
    tenuto_code.push_str("tenuto \"3.0\" {\n");
    if has_swing {
        tenuto_code.push_str(&format!("  meta @{{ title: \"Decompiled Score\", tempo: {}, time: \"{}\", swing: \"66%\" }}\n\n", tempo, time_sig));
    } else {
        tenuto_code.push_str(&format!("  meta @{{ title: \"Decompiled Score\", tempo: {}, time: \"{}\" }}\n\n", tempo, time_sig));
    }

    for def in track_defs {
        tenuto_code.push_str(&def);
    }
    tenuto_code.push_str("\n");

    let mut all_macros = Vec::new();
    let mut track_strings = Vec::new();

    for (track_id, mut notes) in track_events {
        if has_swing {
            for note in &mut notes {
                let start = note.start_tick;
                let end = note.start_tick + note.duration;
                note.start_tick = unswing_tick(start, ticks_per_beat, has_16th_swing);
                let new_end = unswing_tick(end, ticks_per_beat, has_16th_swing);
                note.duration = new_end.saturating_sub(note.start_tick);
            }
        }
        
        // 1. Quantize and format into tokens
        let tokens = notes_to_tokens(&notes, ticks_per_beat);
        
        // 2. Reverse Bresenham (Euclidean Snapping)
        let euclidean_tokens = apply_reverse_bresenham(tokens);
        
        // 3. LZ77 Macro Extraction
        let (compressed_tokens, _) = extract_lz77_macros(euclidean_tokens, &mut all_macros);
        
        // 4. Group into measures and collapse repeats
        let measures = group_into_measures(compressed_tokens, ticks_per_beat, ts_num, ts_den, &all_macros);
        let final_tokens = collapse_repeats(measures);
        
        let track_str = format!("    {}: {} |", track_id, final_tokens.join(" "));
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

fn pitch_to_midi(pitch: &str) -> Option<i32> {
    if pitch.starts_with('r') { return None; }
    let mut chars = pitch.chars();
    let mut step = chars.next()?.to_string();
    let mut next_char = chars.next()?;
    if next_char == '#' {
        step.push('#');
        next_char = chars.next()?;
    }
    let octave_str = format!("{}{}", next_char, chars.as_str());
    let octave: i32 = octave_str.parse().ok()?;
    
    let pc = match step.as_str() {
        "c" => 0, "c#" => 1, "d" => 2, "d#" => 3, "e" => 4, "f" => 5,
        "f#" => 6, "g" => 7, "g#" => 8, "a" => 9, "a#" => 10, "b" => 11,
        _ => return None,
    };
    Some((octave + 1) * 12 + pc)
}

fn split_token(token: &str) -> (Option<String>, String) {
    if token.starts_with("r:") || token == "r" || token.starts_with("$macro") {
        return (None, token.to_string());
    }
    let idx = token.find(|c| c == ':' || c == '(').unwrap_or(token.len());
    let pitch_str = &token[..idx];
    let rest = &token[idx..];
    (Some(pitch_str.to_string()), rest.to_string())
}

fn transpose_token(token: &str, semitones: i32) -> String {
    let (pitch_opt, rest) = split_token(token);
    if let Some(pitch_str) = pitch_opt {
        if let Some(midi) = pitch_to_midi(&pitch_str) {
            let new_midi = (midi + semitones).clamp(0, 127);
            let new_pitch = midi_to_pitch(new_midi as u8);
            return format!("{}{}", new_pitch, rest);
        }
    }
    token.to_string()
}

fn normalize_sequence(seq: &[String]) -> (Vec<String>, i32) {
    let mut first_midi = None;
    for token in seq {
        let (pitch_opt, _) = split_token(token);
        if let Some(pitch_str) = pitch_opt {
            if let Some(midi) = pitch_to_midi(&pitch_str) {
                first_midi = Some(midi);
                break;
            }
        }
    }
    
    if let Some(first_midi) = first_midi {
        let shift = 60 - first_midi;
        let mut normalized = Vec::new();
        for token in seq {
            normalized.push(transpose_token(token, shift));
        }
        (normalized, -shift)
    } else {
        (seq.to_vec(), 0)
    }
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
            let mut first_offsets: HashMap<Vec<String>, i32> = HashMap::new();
            if tokens.len() < len { break; }
            
            let mut i = 0;
            while i <= tokens.len() - len {
                let seq = tokens[i..i+len].to_vec();
                let (norm_seq, offset) = normalize_sequence(&seq);
                *counts.entry(norm_seq.clone()).or_insert(0) += 1;
                first_offsets.entry(norm_seq).or_insert(offset);
                i += 1;
            }
            
            for (norm_seq, _) in counts {
                let mut non_overlapping_count = 0;
                let mut j = 0;
                while j <= tokens.len() - len {
                    let seq = tokens[j..j+len].to_vec();
                    let (seq_norm, _) = normalize_sequence(&seq);
                    if seq_norm == norm_seq {
                        non_overlapping_count += 1;
                        j += len;
                    } else {
                        j += 1;
                    }
                }
                
                if non_overlapping_count > max_count {
                    max_count = non_overlapping_count;
                    best_seq = Some(norm_seq);
                }
            }
            
            if let Some(norm_seq) = best_seq {
                if max_count >= 2 {
                    let macro_idx = all_macros.len();
                    
                    let mut first_actual_seq = None;
                    let mut first_offset = 0;
                    for i in 0..=tokens.len() - len {
                        let seq = tokens[i..i+len].to_vec();
                        let (seq_norm, offset) = normalize_sequence(&seq);
                        if seq_norm == norm_seq {
                            first_actual_seq = Some(seq);
                            first_offset = offset;
                            break;
                        }
                    }
                    
                    let actual_seq = first_actual_seq.unwrap();
                    all_macros.push(actual_seq);
                    
                    let macro_name = format!("$macro_{}", macro_idx);
                    let mut new_tokens = Vec::new();
                    let mut i = 0;
                    while i < tokens.len() {
                        if i + len <= tokens.len() {
                            let seq = tokens[i..i+len].to_vec();
                            let (seq_norm, offset) = normalize_sequence(&seq);
                            if seq_norm == norm_seq {
                                let rel_trans = offset - first_offset;
                                if rel_trans == 0 {
                                    new_tokens.push(macro_name.clone());
                                } else if rel_trans > 0 {
                                    new_tokens.push(format!("{} + {}st", macro_name, rel_trans));
                                } else {
                                    new_tokens.push(format!("{} - {}st", macro_name, -rel_trans));
                                }
                                i += len;
                                continue;
                            }
                        }
                        new_tokens.push(tokens[i].clone());
                        i += 1;
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
