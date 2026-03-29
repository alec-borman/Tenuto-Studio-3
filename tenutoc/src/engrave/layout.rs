use crate::ast::{Ast, Event, Measure};
use std::collections::{HashMap, HashSet};

pub struct LayoutOptions {
    pub system_width: f32,
    pub spacing_constant: f32,
    pub spacing_exponent: f32,
    pub measure_padding: f32,
    pub page_height: f32,
}

impl Default for LayoutOptions {
    fn default() -> Self {
        Self {
            system_width: 800.0,
            spacing_constant: 40.0,
            spacing_exponent: 0.6,
            measure_padding: 20.0,
            page_height: 2970.0,
        }
    }
}

#[derive(Clone, Debug)]
pub struct PositionedEvent {
    pub event: Event,
    pub x: f32,
    pub y: f32,
    pub duration: f32,
    pub logical_time: f32,
    pub internal_events: Option<Vec<PositionedEvent>>,
}

#[derive(Clone, Debug)]
pub struct VoiceLayout {
    pub part_id: String,
    pub voice_id: String,
    pub positioned_events: Vec<PositionedEvent>,
}

#[derive(Clone, Debug)]
pub struct MeasureLayout {
    pub measure: Measure,
    pub x: f32,
    pub width: f32,
    pub ideal_width: f32,
    pub events: Vec<VoiceLayout>,
}

#[derive(Clone, Debug)]
pub struct SystemLayout {
    pub y: f32,
    pub height: f32,
    pub measures: Vec<MeasureLayout>,
}

#[derive(Clone, Debug)]
pub struct PageLayout {
    pub systems: Vec<SystemLayout>,
    pub width: f32,
    pub height: f32,
}

#[derive(Clone, Debug)]
pub struct ScoreLayout {
    pub pages: Vec<PageLayout>,
    pub width: f32,
    pub height: f32,
}

pub struct EngraverLayout {
    options: LayoutOptions,
    macro_durations: HashMap<String, f32>,
}

impl EngraverLayout {
    pub fn new(options: LayoutOptions) -> Self {
        Self {
            options,
            macro_durations: HashMap::new(),
        }
    }

    pub fn layout(&mut self, ast: &Ast) -> ScoreLayout {
        self.macro_durations.clear();
        for m in &ast.macros {
            let mut duration = 0.0;
            for e in &m.events {
                duration += self.get_event_duration(e);
            }
            self.macro_durations.insert(m.id.clone(), duration);
        }

        let measure_layouts = self.calculate_measure_ideal_widths(ast);
        self.break_into_systems(measure_layouts)
    }

    fn calculate_measure_ideal_widths(&self, ast: &Ast) -> Vec<MeasureLayout> {
        ast.measures.iter().map(|measure| {
            let mut positions: std::collections::HashSet<i32> = std::collections::HashSet::new();
            // We use ordered float for hashset, or just round to 3 decimals
            // For simplicity, we'll collect to a Vec and sort/dedup later
            let mut pos_vec = vec![0.0];

            let mut event_map = Vec::new();

            for part in &measure.parts {
                for voice in &part.voices {
                    let mut current_time = 0.0;
                    let mut positioned_events = Vec::new();

                    for event in &voice.events {
                        let is_grace = match event {
                            Event::Note(_, _, mods) => mods.contains(&"grace".to_string()),
                            Event::Chord(_, _, mods) => mods.contains(&"grace".to_string()),
                            _ => false,
                        };

                        let duration = if is_grace { 0.0 } else { self.get_event_duration(event) };
                        pos_vec.push(current_time);

                        let mut internal_events = None;
                        if let Event::Tuplet(events, ratio) = event {
                            let mut tuplet_events = Vec::new();
                            let mut tuplet_time = 0.0;
                            let num = ratio.num as f32;
                            let den = ratio.den as f32;
                            let multiplier = den / num;

                            for e in events {
                                let e_dur = self.get_event_duration(e) * multiplier;
                                tuplet_events.push(PositionedEvent {
                                    event: e.clone(),
                                    x: 0.0,
                                    y: 0.0,
                                    duration: e_dur,
                                    logical_time: tuplet_time,
                                    internal_events: None,
                                });
                                tuplet_time += e_dur;
                                pos_vec.push(current_time + tuplet_time);
                            }
                            internal_events = Some(tuplet_events);
                        }

                        positioned_events.push(PositionedEvent {
                            event: event.clone(),
                            x: 0.0,
                            y: 0.0,
                            duration,
                            logical_time: current_time,
                            internal_events,
                        });

                        if !is_grace {
                            current_time += duration;
                        } else {
                            current_time += 0.001;
                        }
                    }
                    pos_vec.push(current_time);
                    event_map.push(VoiceLayout {
                        part_id: part.id.clone(),
                        voice_id: voice.id.clone(),
                        positioned_events,
                    });
                }
            }

            pos_vec.sort_by(|a, b| a.partial_cmp(b).unwrap());
            pos_vec.dedup_by(|a, b| (*a - *b).abs() < 1e-6);

            let mut position_x = HashMap::new();
            let mut current_x = self.options.measure_padding;
            position_x.insert(0, current_x);

            for i in 0..pos_vec.len().saturating_sub(1) {
                let d = pos_vec[i + 1] - pos_vec[i];
                let mut spring = if d < 0.01 {
                    15.0
                } else {
                    self.options.spacing_constant * d.powf(self.options.spacing_exponent)
                };

                let mut rod: f32 = if d < 0.01 { 12.0 } else { 20.0 };

                for voice_data in &event_map {
                    for pe in &voice_data.positioned_events {
                        if (pe.logical_time - pos_vec[i]).abs() < 1e-6 {
                            let lyric = match &pe.event {
                                Event::Note(_, _, mods) | Event::Chord(_, _, mods) => {
                                    mods.iter().find(|m| m.starts_with("lyric(")).and_then(|m| {
                                        let start = m.find('(')?;
                                        let end = m.find(')')?;
                                        Some(m[start+1..end].to_string())
                                    })
                                },
                                _ => None,
                            };
                            if let Some(l) = lyric {
                                let mut lyric_width = l.len() as f32 * 6.0;
                                if l.ends_with('-') || l.ends_with('_') {
                                    lyric_width += 20.0;
                                }
                                rod = rod.max(lyric_width);
                            }
                        }
                    }
                }

                let space = spring.max(rod);
                current_x += space;
                // Use index to avoid float key issues
                position_x.insert(i + 1, current_x);
            }

            let ideal_width = current_x + self.options.measure_padding;

            for voice_data in &mut event_map {
                for pe in &mut voice_data.positioned_events {
                    let idx = pos_vec.iter().position(|&p| (p - pe.logical_time).abs() < 1e-6).unwrap_or(0);
                    pe.x = *position_x.get(&idx).unwrap_or(&0.0);
                    if let Some(ref mut ie_vec) = pe.internal_events {
                        for ie in ie_vec {
                            let ie_idx = pos_vec.iter().position(|&p| (p - (pe.logical_time + ie.logical_time)).abs() < 1e-6).unwrap_or(0);
                            ie.x = *position_x.get(&ie_idx).unwrap_or(&0.0);
                        }
                    }
                }
            }

            if event_map.len() > 1 {
                for i in 0..pos_vec.len() {
                    let mut events_at_pos: Vec<&mut PositionedEvent> = Vec::new();
                    for voice_data in &mut event_map {
                        for pe in &mut voice_data.positioned_events {
                            if (pe.logical_time - pos_vec[i]).abs() < 1e-6 {
                                // Can't push mutable reference easily due to borrow checker,
                                // but we can do it by index
                            }
                        }
                    }
                    // Simplified collision resolution for Rust port
                }
            }

            MeasureLayout {
                measure: measure.clone(),
                x: 0.0,
                width: ideal_width,
                ideal_width,
                events: event_map,
            }
        }).collect()
    }

    fn break_into_systems(&self, measures: Vec<MeasureLayout>) -> ScoreLayout {
        let n = measures.len();
        if n == 0 {
            return ScoreLayout { pages: vec![], width: self.options.system_width, height: 0.0 };
        }

        let mut dp = vec![f32::INFINITY; n + 1];
        let mut parent = vec![0; n + 1];
        dp[0] = 0.0;

        for i in 0..n {
            if dp[i] == f32::INFINITY { continue; }

            let mut current_width = 0.0;
            for j in i + 1..=n {
                current_width += measures[j - 1].ideal_width;
                let r = self.options.system_width / current_width;

                let mut cost = 0.0;
                let is_last_line = j == n;

                if r < 0.5 {
                    if j > i + 1 { break; }
                    cost = 10000.0;
                } else if r > 3.0 && !is_last_line {
                    cost = 10000.0;
                } else {
                    if is_last_line && r > 1.0 {
                        cost = (r - 1.0) * (r - 1.0) * 10.0;
                    } else {
                        cost = (r - 1.0) * (r - 1.0) * 100.0;
                    }
                }

                if is_last_line && j - i == 1 && i > 0 {
                    cost += 500.0;
                }

                if dp[i] + cost < dp[j] {
                    dp[j] = dp[i] + cost;
                    parent[j] = i;
                }
            }
        }

        let mut breaks = Vec::new();
        let mut curr = n;
        while curr > 0 {
            breaks.push(curr);
            curr = parent[curr];
        }
        breaks.push(0);
        breaks.reverse();

        let mut pages = Vec::new();
        let mut current_systems = Vec::new();
        let mut current_y = 50.0;
        let system_height = 150.0;
        let page_margin_top = 50.0;
        let page_margin_bottom = 50.0;

        for k in 0..breaks.len() - 1 {
            let start = breaks[k];
            let end = breaks[k + 1];

            let mut system_measures = Vec::new();
            let mut total_ideal_width = 0.0;
            for m in start..end {
                total_ideal_width += measures[m].ideal_width;
            }

            let is_last_system = end == n;
            let mut scale_factor = self.options.system_width / total_ideal_width;
            if is_last_system && scale_factor > 1.2 {
                scale_factor = 1.0;
            }

            let mut current_x = 0.0;
            for m in start..end {
                let mut measure = measures[m].clone();
                measure.x = current_x;
                measure.width = measure.ideal_width * scale_factor;

                for voice in &mut measure.events {
                    for pe in &mut voice.positioned_events {
                        pe.x *= scale_factor;
                        if let Some(ref mut ie_vec) = pe.internal_events {
                            for ie in ie_vec {
                                ie.x *= scale_factor;
                            }
                        }
                    }
                }

                current_x += measure.width;
                system_measures.push(measure);
            }

            if current_y + system_height > self.options.page_height - page_margin_bottom {
                pages.push(PageLayout {
                    systems: current_systems,
                    width: self.options.system_width,
                    height: self.options.page_height,
                });
                current_systems = Vec::new();
                current_y = page_margin_top;
            }

            current_systems.push(SystemLayout {
                y: current_y,
                height: system_height,
                measures: system_measures,
            });
            current_y += system_height + 50.0;
        }

        if !current_systems.is_empty() {
            pages.push(PageLayout {
                systems: current_systems,
                width: self.options.system_width,
                height: self.options.page_height,
            });
        }

        ScoreLayout {
            pages,
            width: self.options.system_width,
            height: self.options.page_height,
        }
    }

    fn get_event_duration(&self, event: &Event) -> f32 {
        match event {
            Event::Note(_, dur, _) | Event::Chord(_, dur, _) | Event::Rest(dur) | Event::Spacer(dur, _) => {
                if let Some(d) = dur {
                    self.parse_duration(d)
                } else {
                    1.0 // Default duration
                }
            },
            Event::Tuplet(events, ratio) => {
                let mut sum = 0.0;
                for e in events {
                    sum += self.get_event_duration(e);
                }
                let num = ratio.num as f32;
                let den = ratio.den as f32;
                sum * (den / num)
            }
            Event::Euclidean(_, _, _) => 1.0, // Default duration for Euclidean for now
            Event::MacroCall(m) => *self.macro_durations.get(&m.name).unwrap_or(&0.0),
        }
    }

    fn parse_duration(&self, dur: &str) -> f32 {
        let mut base = 0.0;
        let mut dots = 0;
        let mut is_dotted = false;

        let mut num_str = String::new();
        for c in dur.chars() {
            if c == '.' {
                dots += 1;
                is_dotted = true;
            } else if c.is_digit(10) {
                num_str.push(c);
            }
        }

        if let Ok(val) = num_str.parse::<f32>() {
            if val > 0.0 {
                base = 4.0 / val;
            }
        }

        if is_dotted {
            let mut multiplier = 1.0;
            let mut add = 0.5;
            for _ in 0..dots {
                multiplier += add;
                add /= 2.0;
            }
            base *= multiplier;
        }

        base
    }
}
