use chumsky::prelude::*;
use crate::lexer::Token;
use crate::ast::*;
use std::collections::HashMap;

#[derive(Debug, Clone)]
enum Modifier {
    Simple(String),
    Call(String, Vec<String>),
}

fn modifier() -> impl Parser<Token, Modifier, Error = Simple<Token>> {
    let call = filter_map(|span, tok| match tok {
        Token::Identifier(k) => Ok(k),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    })
    .then(just(Token::Symbol("(".to_string()))
        .ignore_then(filter_map(|span, tok| match tok {
            Token::String(s) => Ok(format!("\"{}\"", s)),
            Token::Identifier(s) => Ok(s),
            Token::Number(s) => Ok(s),
            Token::TimeVal(s) => Ok(s),
            Token::Symbol(s) if s != ")" => Ok(s),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }).repeated())
        .then_ignore(just(Token::Symbol(")".to_string())))
        .or_not())
    .map(|(name, args)| {
        if let Some(args) = args {
            Modifier::Call(name, args)
        } else {
            Modifier::Simple(name)
        }
    });

    call
}

fn duration_with_mods() -> impl Parser<Token, (String, Vec<Modifier>), Error = Simple<Token>> {
    let base_dur = filter_map(|span, tok| match tok {
        Token::Number(n) => Ok(n),
        Token::Identifier(i) => Ok(i), // Sometimes duration is an identifier like "w"
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    });

    let augmentation = just(Token::Symbol(".".to_string())).or_not();

    base_dur.then(augmentation)
        .map(|(num, dot)| if dot.is_some() { format!("{}.", num) } else { num })
        .then(just(Token::Symbol(".".to_string()))
            .ignore_then(modifier())
            .repeated())
}

fn note_parser() -> impl Parser<Token, Vec<Event>, Error = Simple<Token>> {
    let pitch_octave = filter_map(|span, tok| match tok {
        Token::Identifier(i) => Ok(i),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    });

    let euclidean = just(Token::Symbol("(".to_string()))
        .ignore_then(filter_map(|span, tok| match tok {
            Token::Number(n) => n.parse::<u32>().map_err(|_| Simple::custom(span, "Invalid hits")),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }))
        .then_ignore(just(Token::Symbol(",".to_string())))
        .then(filter_map(|span, tok| match tok {
            Token::Number(n) => n.parse::<u32>().map_err(|_| Simple::custom(span, "Invalid steps")),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }))
        .then_ignore(just(Token::Symbol(")".to_string())))
        .or_not();

    pitch_octave
        .then(euclidean)
        .then(just(Token::Symbol(":".to_string())).ignore_then(duration_with_mods()).or_not())
        .map_with_span(|((pitch_lit, eucl), dur_mods), _span| {
            let (duration, mods) = dur_mods.unwrap_or(("4".to_string(), vec![]));
            
            let mut modifiers = Vec::new();
            
            for m in mods {
                match m {
                    Modifier::Simple(s) => {
                        modifiers.push(s);
                    },
                    Modifier::Call(name, args) => {
                        modifiers.push(format!("{}({})", name, args.join("")));
                    }
                }
            }
            
            let (hits, steps) = eucl.unwrap_or((1, 1));
            let mut events = Vec::new();
            
            for i in 0..steps {
                let is_hit = (i * hits) % steps < hits;
                if is_hit {
                    if pitch_lit == "s" {
                        events.push(Event::Spacer(Some(duration.clone()), modifiers.clone()));
                    } else if pitch_lit == "r" {
                        events.push(Event::Rest(Some(duration.clone())));
                    } else {
                        events.push(Event::Note(pitch_lit.clone(), Some(duration.clone()), modifiers.clone()));
                    }
                } else {
                    events.push(Event::Rest(Some(duration.clone())));
                }
            }
            events
        })
}
fn chord_parser() -> impl Parser<Token, Event, Error = Simple<Token>> {
    just(Token::Symbol("[".to_string()))
        .ignore_then(filter_map(|span, tok| match tok {
            Token::Identifier(i) => Ok(i),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }).repeated())
        .then_ignore(just(Token::Symbol("]".to_string())))
        .then(just(Token::Symbol(":".to_string())).ignore_then(duration_with_mods()).or_not())
        .map_with_span(|(notes, dur_mods), _span| {
            let (duration, mods) = dur_mods.unwrap_or(("4".to_string(), vec![]));
            
            let mut modifiers = Vec::new();
            
            for m in mods {
                match m {
                    Modifier::Simple(s) => {
                        modifiers.push(s);
                    },
                    Modifier::Call(name, args) => {
                        modifiers.push(format!("{}({})", name, args.join("")));
                    }
                }
            }
            
            Event::Chord(notes, Some(duration), modifiers)
        })
}

fn event_parser() -> impl Parser<Token, Vec<Event>, Error = Simple<Token>> {
    chord_parser().map(|c| vec![c]).or(note_parser())
}

fn voice_parser() -> impl Parser<Token, Voice, Error = Simple<Token>> {
    let voice_id = filter_map(|span, tok| match tok {
        Token::Identifier(i) => Ok(i),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    })
    .then_ignore(just(Token::Symbol(":".to_string())));

    let events = event_parser().repeated().map(|vecs| vecs.into_iter().flatten().collect());

    voice_id.or_not().then(events).map(|(id, events)| {
        Voice {
            id: id.unwrap_or_else(|| "v1".to_string()),
            events,
        }
    })
}

fn part_parser() -> impl Parser<Token, Part, Error = Simple<Token>> {
    let part_id = filter_map(|span, tok| match tok {
        Token::Identifier(i) => Ok(i),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    })
    .then_ignore(just(Token::Symbol(":".to_string())));

    let single_voice = event_parser().repeated().map(|vecs| {
        let events = vecs.into_iter().flatten().collect();
        vec![Voice {
            id: "v1".to_string(),
            events,
        }]
    });

    let multi_voice = just(Token::VoiceOpen)
        .ignore_then(voice_parser().separated_by(just(Token::Symbol("|".to_string()))))
        .then_ignore(just(Token::VoiceClose));

    part_id.then(multi_voice.or(single_voice)).map(|(id, voices)| {
        Part {
            id,
            meta: None,
            voices,
        }
    })
}

fn measure_parser() -> impl Parser<Token, Vec<Measure>, Error = Simple<Token>> {
    let measure_num = filter_map(|span, tok| match tok {
        Token::Number(n) => n.parse::<usize>().map_err(|_| Simple::custom(span, "Invalid measure number")),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    });

    let measure_range = measure_num.then(just(Token::Symbol("-".to_string())).ignore_then(measure_num).or_not());

    just(Token::Keyword("measure".to_string()))
        .ignore_then(measure_range)
        .then_ignore(just(Token::Symbol("{".to_string())))
        .then(part_parser().separated_by(just(Token::Symbol("|".to_string()))))
        .then_ignore(just(Token::Symbol("}".to_string())))
        .map(|((start, end_opt), parts)| {
            let end = end_opt.unwrap_or(start);
            let mut measures = Vec::new();
            for num in start..=end {
                measures.push(Measure {
                    number: num,
                    meta: None,
                    parts: parts.clone(),
                    markers: None,
                    index: None,
                    absolute_start_tick: None,
                    logic: Vec::new(),
                });
            }
            measures
        })
}

fn def_parser() -> impl Parser<Token, Definition, Error = Simple<Token>> {
    let id = filter_map(|span, tok| match tok {
        Token::Identifier(i) => Ok(i),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    });

    let name = filter_map(|span, tok| match tok {
        Token::String(s) => Ok(s),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    });

    let kv_pair = filter_map(|span, tok| match tok {
        Token::Identifier(i) => Ok(i),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    })
    .then_ignore(just(Token::Symbol("=".to_string())))
    .then(filter_map(|span, tok| match tok {
        Token::Identifier(i) => Ok(i),
        Token::String(s) => Ok(s),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    }));

    let map_entry = filter_map(|span, tok| match tok {
        Token::Identifier(i) => Ok(i),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    })
    .then_ignore(just(Token::Symbol(":".to_string())))
    .then_ignore(just(Token::Symbol("[".to_string())))
    .then(filter_map(|span, tok| match tok {
        Token::TimeVal(t) => Ok(t),
        Token::Number(n) => Ok(n),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    }))
    .then_ignore(just(Token::Symbol(",".to_string())).or_not())
    .then(filter_map(|span, tok| match tok {
        Token::TimeVal(t) => Ok(t),
        Token::Number(n) => Ok(n),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    }).or_not())
    .then_ignore(just(Token::Symbol("]".to_string())));

    let map_block = just(Token::Identifier("map".to_string()))
        .ignore_then(just(Token::Symbol("=".to_string())))
        .ignore_then(just(Token::MapOpen))
        .ignore_then(map_entry.repeated())
        .then_ignore(just(Token::Symbol("}".to_string())))
        .map(|entries| {
            let mut map = std::collections::BTreeMap::new();
            for ((k, v1), v2) in entries {
                // Store as Rational for now, or string? The AST expects Value::Array(Vec<Rational>) or Scalar
                // Let's just store dummy rationals for now, or we can parse the timeval
                // Actually, the AST expects BTreeMap<String, Value>
                // We can parse the TimeVal to a Rational if we want, but let's just store 0/1 for now to pass the AST shape, or parse it properly.
                // Wait, TimeVal is a string like "0ms". Let's just store it as a Rational where num is the parsed number if possible, or we might need to change the AST.
                // Let's look at AST Value. It's Array(Vec<Rational>) or Scalar(Rational).
                // Let's just create a dummy Rational for now, or parse the number part.
                let parse_time = |t: String| -> Rational {
                    let num_str: String = t.chars().take_while(|c| c.is_ascii_digit()).collect();
                    let num = num_str.parse::<u32>().unwrap_or(0);
                    Rational { num, den: 1 }
                };
                let mut arr = vec![parse_time(v1)];
                if let Some(v2) = v2 {
                    arr.push(parse_time(v2));
                }
                map.insert(k, Value::Array(arr));
            }
            map
        });

    just(Token::Keyword("def".to_string()))
        .ignore_then(id)
        .then(name.or_not())
        .then(kv_pair.repeated())
        .then(map_block.or_not())
        .map(|(((id, name), kvs), map)| {
            let mut style = "default".to_string();
            let mut src = None;
            for (k, v) in kvs {
                if k == "style" { style = v.clone(); }
                if k == "src" { src = Some(v.clone()); }
            }
            Definition {
                id,
                name: name.unwrap_or_default(),
                style,
                patch: "".to_string(),
                group: None,
                env: None,
                src,
                tuning: None,
                map,
            }
        })
}

pub fn parser() -> impl Parser<Token, Ast, Error = Simple<Token>> {
    let meta_entry = filter_map(|span, tok| match tok {
        Token::Identifier(k) => Ok(k),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    })
    .then_ignore(just(Token::Symbol(":".to_string())));

    let meta_value_string = filter_map(|span, tok| match tok {
        Token::String(v) => Ok(serde_json::Value::String(v)),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    });

    let meta_value_map = just(Token::MapOpen)
        .ignore_then(
            filter_map(|span, tok| match tok {
                Token::Identifier(k) => Ok(k),
                _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
            })
            .then_ignore(just(Token::Symbol(":".to_string())))
            .then(filter_map(|span, tok| match tok {
                Token::String(v) => Ok(serde_json::Value::String(v)),
                _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
            }))
            .repeated()
        )
        .then_ignore(just(Token::Symbol("}".to_string())))
        .map(|entries| {
            let mut map = serde_json::Map::new();
            for (k, v) in entries {
                map.insert(k, v);
            }
            serde_json::Value::Object(map)
        });

    let meta_value = meta_value_string.or(meta_value_map);

    let meta_block = just(Token::Keyword("meta".to_string()))
        .ignore_then(just(Token::MapOpen))
        .ignore_then(meta_entry.then(meta_value).repeated())
        .then_ignore(just(Token::Symbol("}".to_string())))
        .map(|entries| {
            let mut metadata = HashMap::new();
            for (k, v) in entries {
                metadata.insert(k, v);
            }
            metadata
        });

    let tenuto_header = just(Token::Keyword("tenuto".to_string()))
        .ignore_then(filter_map(|span, tok| match tok {
            Token::String(s) => Ok(s),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }))
        .then_ignore(just(Token::Symbol("{".to_string())));

    tenuto_header.or_not()
        .ignore_then(meta_block.or_not())
        .then(def_parser().repeated())
        .then(measure_parser().repeated().flatten())
        .then_ignore(just(Token::Symbol("}".to_string())).or_not())
        .map(|((meta_opt, defs), measures)| {
            Ast {
                version: "3.0.0".to_string(),
                imports: Vec::new(),
                vars: HashMap::new(),
                meta: meta_opt.unwrap_or_default(),
                defs,
                macros: Vec::new(),
                deterministics: Vec::new(),
                sustainability: Vec::new(),
                measures,
            }
        }).then_ignore(end())
}
