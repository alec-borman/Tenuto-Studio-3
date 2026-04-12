const fs = require('fs');

function fixPhysics() {
    // 1. Mutate ir.rs
    let irPath = 'tenutoc/src/ir.rs';
    let irCode = fs.readFileSync(irPath, 'utf8');

    // Add PartialEq to TimeVal
    irCode = irCode.replace(
        '#[derive(Debug, Clone, Serialize, Deserialize)]\npub enum TimeVal',
        '#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]\npub enum TimeVal'
    );

    // Unroll MacroCall
    const oldMacroLoop = `                for event in voice.events {
                    match event {`;
    const newMacroLoop = `                let mut flat_events = voice.events.clone();
                let mut expanded = true;
                while expanded {
                    expanded = false;
                    let mut next_events = Vec::new();
                    for event in flat_events {
                        if let crate::ast::Event::MacroCall(inv) = &event {
                            if let Some(m_events) = macros_map.get(&inv.name) {
                                next_events.extend(m_events.clone());
                                expanded = true;
                            }
                        } else {
                            next_events.push(event);
                        }
                    }
                    flat_events = next_events;
                }
                for event in flat_events {
                    match event {`;
    
    if (irCode.includes(oldMacroLoop)) {
        irCode = irCode.replace(oldMacroLoop, newMacroLoop);
    }

    // Create macros_map
    const oldCompileStart = `pub fn compile(ast: Ast, _debug: bool) -> Result<Timeline, String> {
    let mut events = Vec::new();`;
    const newCompileStart = `pub fn compile(ast: Ast, _debug: bool) -> Result<Timeline, String> {
    let mut events = Vec::new();
    
    let mut macros_map = HashMap::new();
    for m in &ast.macros {
        macros_map.insert(m.id.clone(), m.events.clone());
    }`;
    
    if (irCode.includes(oldCompileStart)) {
        irCode = irCode.replace(oldCompileStart, newCompileStart);
    }

    // Upgrade .cc() parser
    const oldCcParser = `        } else if m.starts_with("cc(") && m.ends_with(")") {
            // e.g. cc(7, [8], "exp")
            // This is a naive parser for the test. In a real scenario, we'd use a proper parser.
            let inner = &m[3..m.len()-1];
            let parts: Vec<&str> = inner.split(',').collect();
            if parts.len() >= 3 {
                if let Ok(controller) = parts[0].trim().parse::<u8>() {
                    let mut values = Vec::new();
                    let val_str = parts[1].trim();
                    if val_str.starts_with("[") && val_str.ends_with("]") {
                        let inner_vals = &val_str[1..val_str.len()-1];
                        for v in inner_vals.split(',') {
                            if let Ok(val) = v.trim().parse::<u8>() {
                                values.push(val);
                            }
                        }
                    } else {
                        if let Ok(val) = val_str.parse::<u8>() {
                            values.push(val);
                        }
                    }
                    let curve = parts[2].trim().trim_matches('"').to_string();
                    cc = Some((controller, values, curve));
                }
            }
        }`;
    const newCcParser = `        } else if m.starts_with("cc(") && m.ends_with(")") {
            let inner = &m[3..m.len()-1];
            let mut parts = Vec::new();
            let mut current = String::new();
            let mut in_array = false;
            for c in inner.chars() {
                if c == '[' {
                    in_array = true;
                    current.push(c);
                } else if c == ']' {
                    in_array = false;
                    current.push(c);
                } else if c == ',' && !in_array {
                    parts.push(current.clone());
                    current.clear();
                } else {
                    current.push(c);
                }
            }
            parts.push(current);
            
            if parts.len() >= 3 {
                if let Ok(controller) = parts[0].trim().parse::<u8>() {
                    let mut values = Vec::new();
                    let val_str = parts[1].trim();
                    if val_str.starts_with("[") && val_str.ends_with("]") {
                        let inner_vals = &val_str[1..val_str.len()-1];
                        for v in inner_vals.split(',') {
                            if let Ok(val) = v.trim().parse::<u8>() {
                                values.push(val);
                            }
                        }
                    } else {
                        if let Ok(val) = val_str.parse::<u8>() {
                            values.push(val);
                        }
                    }
                    let curve = parts[2].trim().trim_matches('"').to_string();
                    cc = Some((controller, values, curve));
                }
            }
        }`;
    
    if (irCode.includes(oldCcParser)) {
        irCode = irCode.replace(oldCcParser, newCcParser);
    }

    fs.writeFileSync(irPath, irCode);

    // 2. Mutate ast.rs
    let astPath = 'tenutoc/src/ast.rs';
    let astCode = fs.readFileSync(astPath, 'utf8');
    
    const oldAstValue = `#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Value {
    Array(Vec<Rational>),
    Scalar(Rational),
}`;
    const newAstValue = `#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Value {
    Array(Vec<crate::ir::TimeVal>),
    Scalar(crate::ir::TimeVal),
}`;
    
    if (astCode.includes(oldAstValue)) {
        astCode = astCode.replace(oldAstValue, newAstValue);
        fs.writeFileSync(astPath, astCode);
    }

    // 3. Mutate parser.rs
    let parserPath = 'tenutoc/src/parser.rs';
    let parserCode = fs.readFileSync(parserPath, 'utf8');

    const oldParseTime = `                let parse_time = |t: String| -> Rational {
                    let num_str: String = t.chars().take_while(|c| c.is_ascii_digit()).collect();
                    let num = num_str.parse::<u32>().unwrap_or(0);
                    Rational { num, den: 1 }
                };`;
    const newParseTime = `                let parse_time = |t: String| -> crate::ir::TimeVal {
                    let num_str: String = t.chars().take_while(|c| c.is_ascii_digit() || c == '.' || c == '-').collect();
                    let num = num_str.parse::<i64>().unwrap_or(0);
                    let r = crate::ir::Rational::new(num, 1);
                    if t.ends_with("ms") {
                        crate::ir::TimeVal::Milliseconds(r)
                    } else if t.ends_with("s") {
                        crate::ir::TimeVal::Seconds(r)
                    } else {
                        crate::ir::TimeVal::Ticks(r)
                    }
                };`;
    
    if (parserCode.includes(oldParseTime)) {
        parserCode = parserCode.replace(oldParseTime, newParseTime);
        fs.writeFileSync(parserPath, parserCode);
    }

    // 4. Mutate sidechain.rs
    let sidechainPath = 'tenutoc/src/sidechain.rs';
    let sidechainCode = fs.readFileSync(sidechainPath, 'utf8');

    const oldSidechainLogic = `    // Second pass: apply ducking
    // In a real implementation we would generate CC curves based on the sidechain sources
    // For now, the test just checks if the spacer generates CC events, which is handled in ir.rs`;
    const newSidechainLogic = `    // Second pass: apply ducking
    let mut new_events = Vec::new();
    for (target, source) in sidechain_map {
        if let Some(source_events) = sidechain_sources.get(&source) {
            for src_event in source_events {
                let steps = 4;
                let step_dur = src_event.logical_duration / Rational::new(steps, 1);
                for i in 0..steps {
                    let value = if i == 0 { 0 } else { (127 * i / (steps - 1)) as u8 };
                    new_events.push(TimelineNode {
                        track_id: target.clone(),
                        voice_id: "sidechain_auto".to_string(),
                        track_style: "automation".to_string(),
                        track_patch: "default".to_string(),
                        track_cut_group: None,
                        logical_time: src_event.logical_time + (step_dur * Rational::new(i, 1)),
                        logical_duration: step_dur,
                        physical_offset: None,
                        kind: EventKind::MidiCC { controller: 11, value },
                        lyric: None,
                        lyric_extension: crate::ir::LyricExtension::None,
                        synth_accelerate_semitones: None,
                        pan: None,
                        orbit: None,
                        fx_chain: Vec::new(),
                    });
                }
            }
        }
    }
    timeline.events.extend(new_events);`;

    if (sidechainCode.includes(oldSidechainLogic)) {
        sidechainCode = sidechainCode.replace(oldSidechainLogic, newSidechainLogic);
        fs.writeFileSync(sidechainPath, sidechainCode);
    }

    console.log('Physics fix applied.');
}

fixPhysics();
