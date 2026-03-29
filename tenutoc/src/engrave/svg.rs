use crate::ast::{Ast, Event, Measure, Note, Chord, Tuplet};
use super::layout::{EngraverLayout, LayoutOptions, ScoreLayout, SystemLayout, MeasureLayout, PositionedEvent};
use super::skyline::Skyline;
use super::kurbo::{Kurbo, Point};
use super::smufl::get_smufl_metadata;
use std::collections::{HashMap, HashSet};

pub fn export_svg(ast: &Ast) -> Result<String, String> {
    let mut layout_engine = EngraverLayout::new(LayoutOptions::default());
    let layout = layout_engine.layout(ast);
    
    let mut svgs = Vec::new();
    
    for page in &layout.pages {
        let mut svg_parts = String::new();
        svg_parts.push_str(&format!("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\">", page.width, page.height, page.width, page.height));
        
        svg_parts.push_str("<style>
        .staff-line { stroke: #000; stroke-width: 1px; }
        .barline { stroke: #000; stroke-width: 1.5px; }
        .notehead { fill: #000; }
        .stem { stroke: #000; stroke-width: 1.2px; }
        .ledger { stroke: #000; stroke-width: 1.5px; }
        .clef { font-family: serif; font-size: 40px; }
        .time-sig { font-family: serif; font-size: 24px; font-weight: bold; }
      </style>");

        for system in &page.systems {
            svg_parts.push_str(&render_system(system, ast));
        }

        svg_parts.push_str("</svg>");
        svgs.push(svg_parts);
    }
    
    // For now, return a JSON array of SVG strings
    serde_json::to_string(&svgs).map_err(|e| e.to_string())
}

fn render_system(system: &SystemLayout, ast: &Ast) -> String {
    let mut svg_parts = String::new();
    svg_parts.push_str(&format!("<g transform=\"translate(0, {})\">", system.y));
    
    let parts: Vec<String> = ast.defs.iter().map(|d| d.id.clone()).collect();
    let staff_height = 40.0;
    let staff_spacing = 150.0;
    
    let mut groups: HashMap<String, Vec<usize>> = HashMap::new();
    for (i, d) in ast.defs.iter().enumerate() {
        if let Some(group) = &d.group {
            groups.entry(group.clone()).or_default().push(i);
        }
    }

    for (group_name, indices) in &groups {
        if indices.len() > 1 {
            let start_y = *indices.iter().min().unwrap() as f32 * staff_spacing;
            let end_y = *indices.iter().max().unwrap() as f32 * staff_spacing + staff_height;
            
            svg_parts.push_str(&format!("<path d=\"M -5 {} L -15 {} L -15 {} L -5 {}\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" />", start_y, start_y, end_y, end_y));
            let mid_y = (start_y + end_y) / 2.0;
            svg_parts.push_str(&format!("<text x=\"-25\" y=\"{}\" font-family=\"sans-serif\" font-size=\"12px\" text-anchor=\"middle\" dominant-baseline=\"middle\" transform=\"rotate(-90 -25 {})\">{}</text>", mid_y, mid_y, group_name));
        }
    }

    let system_start_x = 85.0;

    for (part_index, _part_id) in parts.iter().enumerate() {
        let staff_y = part_index as f32 * staff_spacing;
        let total_system_width = system.measures.iter().fold(system_start_x, |sum, m| sum + m.width);
        
        for i in 0..5 {
            let y = staff_y + i as f32 * 10.0;
            svg_parts.push_str(&format!("<line x1=\"0\" y1=\"{}\" x2=\"{}\" y2=\"{}\" class=\"staff-line\" shape-rendering=\"crispEdges\" />", y, total_system_width, y));
        }
        
        let is_treble = part_index == 0;
        let clef_char = if is_treble { "𝄞" } else { "𝄢" };
        let clef_y = if is_treble { staff_y + 34.0 } else { staff_y + 28.0 };
        svg_parts.push_str(&format!("<text x=\"15\" y=\"{}\" class=\"clef\" font-size=\"46px\">{}</text>", clef_y, clef_char));
        
        let mut start_barline = format!("<line x1=\"0\" y1=\"{}\" x2=\"0\" y2=\"{}\" class=\"barline\" shape-rendering=\"crispEdges\" />", staff_y, staff_y + 40.0);
        if let Some(first_measure) = system.measures.first() {
            if let Some(markers) = &first_measure.measure.markers {
                if markers.contains(&"|:".to_string()) {
                    start_barline = format!("
          <line x1=\"0\" y1=\"{0}\" x2=\"0\" y2=\"{1}\" class=\"barline\" stroke-width=\"3\" shape-rendering=\"crispEdges\" />
          <line x1=\"6\" y1=\"{0}\" x2=\"6\" y2=\"{1}\" class=\"barline\" stroke-width=\"1\" shape-rendering=\"crispEdges\" />
          <circle cx=\"12\" cy=\"{2}\" r=\"2\" fill=\"#000\" />
          <circle cx=\"12\" cy=\"{3}\" r=\"2\" fill=\"#000\" />
        ", staff_y, staff_y + 40.0, staff_y + 15.0, staff_y + 25.0);
                }
            }
        }
        svg_parts.push_str(&start_barline);
    }

    let total_width = system.measures.iter().fold(0.0, |sum, m| sum + m.width) + 100.0;
    let mut top_skyline = Skyline::new(total_width, 10.0, true);
    let mut bottom_skyline = Skyline::new(total_width, 10.0, false);

    let mut current_x = system_start_x;
    for measure in &system.measures {
        svg_parts.push_str(&format!("<g transform=\"translate({}, 0)\">", current_x));
        
        if measure.measure.number != 1 {
            svg_parts.push_str(&format!("<text x=\"0\" y=\"-15\" font-family=\"serif\" font-size=\"12px\" font-style=\"italic\" fill=\"#666\">{}</text>", measure.measure.number));
        }
        
        let mut accidental_state: HashMap<String, HashMap<String, String>> = HashMap::new();

        for part_data in &measure.events {
            let part_index = parts.iter().position(|p| p == &part_data.part_id);
            if part_index.is_none() { continue; }
            let part_index = part_index.unwrap();
            
            let staff_y = part_index as f32 * staff_spacing;
            let part_accidental_state = accidental_state.entry(part_data.part_id.clone()).or_default();

            // Simplified rendering for now
            for i in 0..part_data.positioned_events.len() {
                let pe = &part_data.positioned_events[i];
                let next_pe = part_data.positioned_events.get(i + 1);
                svg_parts.push_str(&render_event(pe, next_pe, staff_y, &mut top_skyline, &mut bottom_skyline, &parts, staff_spacing, current_x, part_accidental_state));
            }
        }
        
        for (part_index, _part_id) in parts.iter().enumerate() {
            let staff_y = part_index as f32 * staff_spacing;
            let mut end_barline = format!("<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" class=\"barline\" />", measure.width, staff_y, measure.width, staff_y + 40.0);
            
            if let Some(markers) = &measure.measure.markers {
                if markers.contains(&":|".to_string()) {
                    end_barline = format!("
            <line x1=\"{0}\" y1=\"{2}\" x2=\"{0}\" y2=\"{3}\" class=\"barline\" stroke-width=\"1\" />
            <line x1=\"{1}\" y1=\"{2}\" x2=\"{1}\" y2=\"{3}\" class=\"barline\" stroke-width=\"3\" />
            <circle cx=\"{4}\" cy=\"{5}\" r=\"2\" fill=\"#000\" />
            <circle cx=\"{4}\" cy=\"{6}\" r=\"2\" fill=\"#000\" />
          ", measure.width - 4.0, measure.width, staff_y, staff_y + 40.0, measure.width - 8.0, staff_y + 15.0, staff_y + 25.0);
                }
            }
            svg_parts.push_str(&end_barline);
        }
        
        svg_parts.push_str("</g>");
        current_x += measure.width;
    }

    svg_parts.push_str("</g>");
    svg_parts
}

fn get_pitch_y(pitch: &str, octave: i32, staff_y: f32) -> f32 {
    if pitch == "r" {
        return staff_y + 20.0;
    }
    let step = match pitch.to_lowercase().as_str() {
        "c" => 0, "d" => 1, "e" => 2, "f" => 3, "g" => 4, "a" => 5, "b" => 6, _ => 0
    };
    let c4_y = staff_y + 50.0;
    let steps_from_c4 = (octave - 4) * 7 + step;
    c4_y - steps_from_c4 as f32 * 5.0
}

fn render_event(
    pe: &PositionedEvent, 
    next_pe: Option<&PositionedEvent>, 
    staff_y: f32, 
    top_skyline: &mut Skyline, 
    bottom_skyline: &mut Skyline, 
    parts: &[String], 
    staff_spacing: f32, 
    measure_x: f32, 
    part_accidental_state: &mut HashMap<String, String>
) -> String {
    let mut svg = String::new();
    if let Event::Note(note) = &pe.event {
        svg.push_str(&render_note(pe, note, pe.x, next_pe.map(|p| p.x), staff_y, top_skyline, bottom_skyline, parts, staff_spacing, measure_x, part_accidental_state));
    } else if let Event::Chord(chord) = &pe.event {
        for note in &chord.notes {
            svg.push_str(&render_note(pe, note, pe.x, next_pe.map(|p| p.x), staff_y, top_skyline, bottom_skyline, parts, staff_spacing, measure_x, part_accidental_state));
        }
    }
    svg
}

fn render_note(
    pe: &PositionedEvent, 
    note: &Note, 
    x: f32, 
    next_x: Option<f32>, 
    staff_y: f32, 
    top_skyline: &mut Skyline, 
    bottom_skyline: &mut Skyline, 
    parts: &[String], 
    staff_spacing: f32, 
    measure_x: f32, 
    part_accidental_state: &mut HashMap<String, String>
) -> String {
    let mut target_staff_y = staff_y;
    if let Some(cross) = &note.cross {
        if let Some(idx) = parts.iter().position(|p| p == cross) {
            target_staff_y = idx as f32 * staff_spacing;
        }
    }

    let y = get_pitch_y(&note.pitch, note.octave.unwrap_or(4), target_staff_y);
    let mut svg = String::new();

    if note.pitch != "r" {
        let max_ledgers = 15;
        if y > target_staff_y + 40.0 && y <= target_staff_y + 40.0 + max_ledgers as f32 * 10.0 {
            let mut ly = target_staff_y + 50.0;
            while ly <= y {
                svg.push_str(&format!("<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" class=\"ledger\" stroke-width=\"1.2\" shape-rendering=\"crispEdges\" />", x - 3.0, ly, x + 13.0, ly));
                ly += 10.0;
            }
        } else if y < target_staff_y && y >= target_staff_y - max_ledgers as f32 * 10.0 {
            let mut ly = target_staff_y - 10.0;
            while ly >= y {
                svg.push_str(&format!("<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" class=\"ledger\" stroke-width=\"1.2\" shape-rendering=\"crispEdges\" />", x - 3.0, ly, x + 13.0, ly));
                ly -= 10.0;
            }
        }
    }

    let is_grace = note.modifiers.as_ref().map_or(false, |m| m.contains(&"grace".to_string()));
    let scale = if is_grace { 0.7 } else { 1.0 };

    let mut duration_val = 4;
    let mut dur_str = note.duration.clone();
    if dur_str.ends_with('.') {
        dur_str.pop();
    }
    if let Ok(parsed_dur) = dur_str.parse::<i32>() {
        if parsed_dur > 0 {
            duration_val = parsed_dur;
        }
    }

    let mut glyph_name = "noteheadBlack";
    if duration_val == 2 { glyph_name = "noteheadHalf"; }
    if duration_val == 1 { glyph_name = "noteheadWhole"; }

    if let Some(glyph) = get_smufl_metadata(glyph_name) {
        let glyph_scale = 10.0 * scale;
        let offset_x = x - glyph.optical_center * glyph_scale;
        svg.push_str(&format!("<path d=\"{}\" transform=\"translate({}, {}) scale({})\" class=\"notehead\" />", glyph.path, offset_x + 5.0, y, glyph_scale));

        let absolute_x = measure_x + x;
        top_skyline.insert(absolute_x / 10.0, 1.2 * scale, y - 5.0 * scale);
        bottom_skyline.insert(absolute_x / 10.0, 1.2 * scale, y + 5.0 * scale);

        let stem_up = y > target_staff_y + 20.0;
        if duration_val >= 2 || is_grace {
            let stem_height = 30.0 * scale;
            let stem_anchor = if stem_up { glyph.stem_up_se } else { glyph.stem_down_nw };
            let stem_x = offset_x + 5.0 + stem_anchor[0] * glyph_scale;
            let stem_start_y = y + stem_anchor[1] * glyph_scale;
            let stem_end_y = if stem_up { stem_start_y - stem_height } else { stem_start_y + stem_height };

            svg.push_str(&format!("<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" class=\"stem\" />", stem_x, stem_start_y, stem_x, stem_end_y));
            top_skyline.insert((measure_x + stem_x - 1.0) / 10.0, 0.2, stem_start_y.min(stem_end_y));
            bottom_skyline.insert((measure_x + stem_x - 1.0) / 10.0, 0.2, stem_start_y.max(stem_end_y));
        }
    }

    if note.pitch != "r" {
        let pitch_key = format!("{}{}", note.pitch.to_lowercase(), note.octave.unwrap_or(4));
        let current_accidental = note.accidental.clone().unwrap_or_default();
        let previous_accidental = part_accidental_state.get(&pitch_key).cloned().unwrap_or_default();

        let mut acc_symbol = "";
        if current_accidental != previous_accidental {
            if current_accidental == "#" { acc_symbol = "♯"; }
            else if current_accidental == "b" { acc_symbol = "♭"; }
            else if current_accidental == "+" { acc_symbol = "𝄲"; }
            else if current_accidental == "-" { acc_symbol = "𝄳"; }
            else if current_accidental == "" { acc_symbol = "♮"; }
            
            part_accidental_state.insert(pitch_key, current_accidental);
        }

        if !acc_symbol.is_empty() {
            let acc_x = x - 15.0;
            svg.push_str(&format!("<text x=\"{}\" y=\"{}\" font-family=\"serif\" font-size=\"{}\">{}</text>", acc_x, y + 5.0, 18.0 * scale, acc_symbol));
        }
    }

    if let Some(modifiers) = &note.modifiers {
        for mod_str in modifiers {
            if mod_str == "slur" || mod_str == "tie" {
                let arc_start_x = x + 5.0;
                let arc_end_x = next_x.map(|nx| nx + 5.0).unwrap_or(x + 30.0);
                let stem_up = y > target_staff_y + 20.0;
                let is_top = !stem_up;
                let dir = if is_top { -1.0 } else { 1.0 };
                
                let p0 = Point { x: arc_start_x, y: y + dir * 10.0 };
                let p3 = Point { x: arc_end_x, y: y + dir * 10.0 };
                
                let skyline = if is_top { &*top_skyline } else { &*bottom_skyline };
                let [cp0, cp1, cp2, cp3] = Kurbo::route_slur(p0, p3, skyline, is_top, measure_x);
                
                svg.push_str(&format!("<path d=\"M {} {} C {} {}, {} {}, {} {}\" fill=\"none\" stroke=\"#000\" stroke-width=\"1.5\" />", cp0.x, cp0.y, cp1.x, cp1.y, cp2.x, cp2.y, cp3.x, cp3.y));
            }
        }
    }

    svg
}
