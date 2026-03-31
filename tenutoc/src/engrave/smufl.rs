pub struct SmuflGlyph {
    pub path: &'static str,
    pub optical_center: f32,
    pub stem_up_se: [f32; 2],
    pub stem_down_nw: [f32; 2],
}

pub fn get_smufl_metadata(name: &str) -> Option<&'static SmuflGlyph> {
    match name {
        "noteheadBlack" => Some(&SmuflGlyph {
            path: "M 0 0 C 0 -0.3 0.3 -0.5 0.6 -0.5 C 0.9 -0.5 1.2 -0.3 1.2 0 C 1.2 0.3 0.9 0.5 0.6 0.5 C 0.3 0.5 0 0.3 0 0 Z",
            optical_center: 0.6,
            stem_up_se: [1.18, -0.16],
            stem_down_nw: [0.02, 0.16],
        }),
        "noteheadHalf" => Some(&SmuflGlyph {
            path: "M 0 0 C 0 -0.3 0.3 -0.5 0.6 -0.5 C 0.9 -0.5 1.2 -0.3 1.2 0 C 1.2 0.3 0.9 0.5 0.6 0.5 C 0.3 0.5 0 0.3 0 0 Z M 0.2 0 C 0.2 -0.2 0.4 -0.3 0.6 -0.3 C 0.8 -0.3 1.0 -0.2 1.0 0 C 1.0 0.2 0.8 0.3 0.6 0.3 C 0.4 0.3 0.2 0.2 0.2 0 Z",
            optical_center: 0.6,
            stem_up_se: [1.18, -0.16],
            stem_down_nw: [0.02, 0.16],
        }),
        "noteheadWhole" => Some(&SmuflGlyph {
            path: "M 0 0 C 0 -0.4 0.4 -0.6 0.8 -0.6 C 1.2 -0.6 1.6 -0.4 1.6 0 C 1.6 0.4 1.2 0.6 0.8 0.6 C 0.4 0.6 0 0.4 0 0 Z M 0.3 0 C 0.3 -0.2 0.5 -0.3 0.8 -0.3 C 1.1 -0.3 1.3 -0.2 1.3 0 C 1.3 0.2 1.1 0.3 0.8 0.3 C 0.5 0.3 0.3 0.2 0.3 0 Z",
            optical_center: 0.8,
            stem_up_se: [1.6, -0.16],
            stem_down_nw: [0.0, 0.16],
        }),
        "gClef" => Some(&SmuflGlyph {
            path: "M 0 0 C 0.5 -1 1.5 -2 1.5 -3 C 1.5 -4 0.5 -5 0 -5 C -0.5 -5 -1.5 -4 -1.5 -3 C -1.5 -2 -0.5 -1 0 0 C 0.5 1 1.5 2 1.5 3 C 1.5 4 0.5 5 0 5 C -0.5 5 -1.5 4 -1.5 3 C -1.5 2 -0.5 1 0 0 Z",
            optical_center: 0.0,
            stem_up_se: [0.0, 0.0],
            stem_down_nw: [0.0, 0.0],
        }),
        "fClef" => Some(&SmuflGlyph {
            path: "M 0 -1 C 0.5 -2 1.5 -3 1.5 -4 C 1.5 -5 0.5 -6 0 -6 C -0.5 -6 -1.5 -5 -1.5 -4 C -1.5 -3 -0.5 -2 0 -1 Z M 2 -3 A 0.2 0.2 0 1 1 2 -3.4 A 0.2 0.2 0 1 1 2 -3 Z M 2 -4 A 0.2 0.2 0 1 1 2 -4.4 A 0.2 0.2 0 1 1 2 -4 Z",
            optical_center: 0.0,
            stem_up_se: [0.0, 0.0],
            stem_down_nw: [0.0, 0.0],
        }),
        "dynamicPiano" => Some(&SmuflGlyph {
            path: "M 0 0 C 2 0 4 2 4 4 C 4 6 2 8 0 8 L 0 12 L -2 12 L -2 -2 L 0 -2 Z M 0 2 L 0 6 C 1 6 2 5 2 4 C 2 3 1 2 0 2 Z",
            optical_center: 1.0,
            stem_up_se: [0.0, 0.0],
            stem_down_nw: [0.0, 0.0],
        }),
        "dynamicForte" => Some(&SmuflGlyph {
            path: "M 4 -2 L 2 -2 C 0 -2 -1 -1 -1 1 L -1 4 L -3 4 L -3 6 L -1 6 L -1 12 L 1 12 L 1 6 L 3 6 L 3 4 L 1 4 L 1 1 C 1 0 2 0 3 0 L 4 0 Z",
            optical_center: 1.0,
            stem_up_se: [0.0, 0.0],
            stem_down_nw: [0.0, 0.0],
        }),
        "dynamicMezzo" => Some(&SmuflGlyph {
            path: "M -4 8 L -4 0 L -2 0 L -1 4 L 0 0 L 2 0 L 2 8 L 0 8 L 0 4 L -1 6 L -2 4 L -2 8 Z",
            optical_center: 0.0,
            stem_up_se: [0.0, 0.0],
            stem_down_nw: [0.0, 0.0],
        }),
        "accidentalSharp" => Some(&SmuflGlyph {
            path: "M 0.2 1.5 L 0.2 -1.5 L 0.5 -1.5 L 0.5 1.5 Z M 0.8 1.2 L 0.8 -1.8 L 1.1 -1.8 L 1.1 1.2 Z M -0.2 0.5 L 1.5 -0.2 L 1.5 0.1 L -0.2 0.8 Z M -0.2 -0.5 L 1.5 -1.2 L 1.5 -0.9 L -0.2 -0.2 Z",
            optical_center: 0.5,
            stem_up_se: [0.0, 0.0],
            stem_down_nw: [0.0, 0.0],
        }),
        "accidentalFlat" => Some(&SmuflGlyph {
            path: "M 0 -2 L 0 1.5 C 0.5 1.5 1 1 1 0.5 C 1 0 0.5 -0.5 0 -0.5 Z M 0.2 0.2 C 0.5 0.2 0.8 0.5 0.8 0.8 C 0.8 1.1 0.5 1.3 0.2 1.3 Z",
            optical_center: 0.5,
            stem_up_se: [0.0, 0.0],
            stem_down_nw: [0.0, 0.0],
        }),
        "accidentalNatural" => Some(&SmuflGlyph {
            path: "M 0.2 1.5 L 0.2 -1.5 L 0.4 -1.5 L 0.4 1.5 Z M 0.8 1.5 L 0.8 -1.5 L 1.0 -1.5 L 1.0 1.5 Z M 0.2 0.5 L 1.0 0.2 L 1.0 0.4 L 0.2 0.7 Z M 0.2 -0.2 L 1.0 -0.5 L 1.0 -0.3 L 0.2 0.0 Z",
            optical_center: 0.5,
            stem_up_se: [0.0, 0.0],
            stem_down_nw: [0.0, 0.0],
        }),
        _ => None,
    }
}
