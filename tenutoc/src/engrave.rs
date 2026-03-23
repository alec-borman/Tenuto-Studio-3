use crate::rebar::VisualScore;
use crate::ir::{EventKind, LyricExtension};
use crate::spelling::AccidentalDisplay;

pub fn export_svg(score: &VisualScore) -> Result<String, String> {
    let mut svg = String::with_capacity(1024 * 100);

    svg.push_str("<svg viewBox=\"0 0 2100 2970\" xmlns=\"http://www.w3.org/2000/svg\">\n");
    svg.push_str("  <style>\n");
    svg.push_str("    .staff-lines { stroke: #1a1a1a; stroke-width: 1.2; }\n");
    svg.push_str("    .barline { stroke: #1a1a1a; stroke-width: 1.5; }\n");
    svg.push_str("    .thick-barline { stroke: #1a1a1a; stroke-width: 4; }\n");
    svg.push_str("    .glyph { fill: #1a1a1a; }\n");
    svg.push_str("    .text { font-family: 'Times New Roman', serif; fill: #1a1a1a; }\n");
    svg.push_str("    .title { font-family: 'Times New Roman', serif; font-size: 36px; font-weight: bold; }\n");
    svg.push_str("    .tempo { font-family: 'Times New Roman', serif; font-size: 18px; font-weight: bold; }\n");
    svg.push_str("    .instrument { font-family: 'Times New Roman', serif; font-size: 18px; font-style: italic; }\n");
    svg.push_str("  </style>\n");

    svg.push_str(&format!("  <text x=\"1050\" y=\"120\" text-anchor=\"middle\" class=\"title\">{}</text>\n", escape_xml(&score.title)));
    
    // Tempo Marking
    svg.push_str("  <text x=\"150\" y=\"180\" class=\"tempo\">♩ = 120</text>\n");

    let mut y_offset = 250;

    for (staff_id, staff) in &score.staves {
        if !staff.print { continue; }

        svg.push_str(&format!("  <!-- Staff: {} -->\n", staff_id));
        svg.push_str(&format!("  <g class=\"system\" transform=\"translate(150, {})\">\n", y_offset));
        
        // Instrument Name
        svg.push_str(&format!("    <text x=\"-20\" y=\"25\" text-anchor=\"end\" class=\"instrument\">{}</text>\n", escape_xml(staff_id)));
        
        // Draw 5 staff lines
        for i in 0..5 {
            let line_y = i * 10;
            svg.push_str(&format!("    <path class=\"staff-lines\" d=\"M 0 {} L 1800 {}\" />\n", line_y, line_y));
        }

        // System Bracket (if part of a grand staff, but we'll draw a simple starting barline for now)
        svg.push_str("    <path class=\"barline\" d=\"M 0 0 L 0 40\" />\n");
        
        // Clef (Treble Clef by default for now)
        svg.push_str("    <text x=\"10\" y=\"32\" font-size=\"45\" font-family=\"serif\" class=\"glyph\">𝄞</text>\n");
        
        // Key Signature (C Major by default)
        // Time Signature (4/4 by default)
        svg.push_str("    <g transform=\"translate(50, 0)\">\n");
        svg.push_str("      <text x=\"0\" y=\"18\" font-size=\"24\" font-weight=\"bold\" font-family=\"serif\" class=\"glyph\">4</text>\n");
        svg.push_str("      <text x=\"0\" y=\"38\" font-size=\"24\" font-weight=\"bold\" font-family=\"serif\" class=\"glyph\">4</text>\n");
        svg.push_str("    </g>\n");

        let mut x_offset = 100;

        for measure in &staff.measures {
            svg.push_str(&format!("    <!-- Measure {} -->\n", measure.number));
            svg.push_str(&format!("    <g class=\"measure\" data-measure=\"{}\" data-start-tick=\"{}\" data-end-tick=\"{}\">\n", measure.number, measure.start_tick, measure.end_tick));

            for event in &measure.events {
                let is_space = matches!(event.atomic.kind, EventKind::Space);
                if is_space {
                    x_offset += 20;
                    continue;
                }

                svg.push_str(&format!("      <g class=\"note\" data-tick=\"{}\">\n", event.atomic.tick));

                match &event.atomic.kind {
                    EventKind::Rest | EventKind::Concrete { .. } | EventKind::Frequency { .. } => {
                        svg.push_str(&format!("        <rect x=\"{}\" y=\"10\" width=\"10\" height=\"20\" fill=\"#1a1a1a\" />\n", x_offset));
                    },
                    EventKind::Note { spelling, .. } => {
                        // Calculate Y position based on pitch (C4 = middle C)
                        let base_y = 50; // middle line
                        let step_offset = match spelling.step {
                            crate::spelling::Step::C => 3,
                            crate::spelling::Step::D => 2,
                            crate::spelling::Step::E => 1,
                            crate::spelling::Step::F => 0,
                            crate::spelling::Step::G => -1,
                            crate::spelling::Step::A => -2,
                            crate::spelling::Step::B => -3,
                        };
                        let octave_offset = (4 - spelling.octave as i32) * 7;
                        let note_y = base_y + (step_offset + octave_offset) * 5;

                        if spelling.display != AccidentalDisplay::Implicit {
                            let acc_char = match spelling.alter {
                                1 => "♯",
                                -1 => "♭",
                                0 => "♮",
                                2 => "𝄪",
                                -2 => "𝄫",
                                _ => "",
                            };
                            svg.push_str(&format!("        <text x=\"{}\" y=\"{}\" class=\"text\">{}</text>\n", x_offset - 15, note_y + 5, acc_char));
                        }

                        // Notehead
                        svg.push_str(&format!("        <ellipse cx=\"{}\" cy=\"{}\" rx=\"6\" ry=\"4\" class=\"glyph\" transform=\"rotate(-20 {} {})\" />\n", x_offset, note_y, x_offset, note_y));
                        
                        // Stem
                        svg.push_str(&format!("        <line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"#1a1a1a\" stroke-width=\"1.2\" />\n", x_offset + 5, note_y, x_offset + 5, note_y - 30));
                    },
                    _ => {}
                }

                if let Some(lyric) = &event.atomic.lyric {
                    svg.push_str(&format!("        <text x=\"{}\" y=\"80\" text-anchor=\"middle\" class=\"text\">{}</text>\n", x_offset, escape_xml(lyric)));
                    if event.atomic.lyric_extension == LyricExtension::Melisma {
                        svg.push_str(&format!("        <line x1=\"{}\" y1=\"80\" x2=\"{}\" y2=\"80\" stroke=\"#1a1a1a\" stroke-width=\"1\" />\n", x_offset + 10, x_offset + 30));
                    }
                }

                svg.push_str("      </g>\n");
                x_offset += 40; // Simple linear spacing
            }

            // Barline
            svg.push_str(&format!("      <path class=\"barline\" d=\"M {} 0 L {} 40\" />\n", x_offset, x_offset));
            svg.push_str("    </g>\n");
        }

        // Final Barline
        svg.push_str(&format!("    <path class=\"barline\" d=\"M {} 0 L {} 40\" />\n", x_offset + 10, x_offset + 10));
        svg.push_str(&format!("    <path class=\"thick-barline\" d=\"M {} 0 L {} 40\" />\n", x_offset + 16, x_offset + 16));

        svg.push_str("  </g>\n");
        y_offset += 150;
    }

    svg.push_str("</svg>\n");
    Ok(svg)
}

fn escape_xml(input: &str) -> String {
    input.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&apos;")
}
