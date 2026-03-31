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
            Token::Symbol(s) if s == ")" => Err(Simple::expected_input_found(span, Vec::new(), Some(Token::Symbol(")".to_string())))),
            Token::String(s) => Ok(format!("\"{}\"", s)),
            Token::Identifier(s) => Ok(s),
            Token::Number(s) => Ok(s),
            Token::Symbol(s) => Ok(s),
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
                    events.push(Event::Note(pitch_lit.clone(), Some(duration.clone()), modifiers.clone()));
                } else {
                    events.push(Event::Note("r".to_string(), Some(duration.clone()), vec![]));
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

    let single_voice = voice_parser().map(|v| vec![v]);

    let multi_voice = just(Token::Symbol("<".to_string()))
        .ignore_then(just(Token::Symbol("[".to_string())))
        .ignore_then(voice_parser().separated_by(just(Token::Symbol("|".to_string()))))
        .then_ignore(just(Token::Symbol("]".to_string())))
        .then_ignore(just(Token::Symbol(">".to_string())));

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

pub fn parser() -> impl Parser<Token, Ast, Error = Simple<Token>> {
    let meta_entry = filter_map(|span, tok| match tok {
        Token::Identifier(k) => Ok(k),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    })
    .then_ignore(just(Token::Symbol(":".to_string())))
    .then(filter_map(|span, tok| match tok {
        Token::String(v) => Ok(v),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    }));

    let meta_block = just(Token::Keyword("meta".to_string()))
        .ignore_then(just(Token::Symbol("@".to_string())))
        .ignore_then(just(Token::Symbol("{".to_string())))
        .ignore_then(meta_entry.repeated())
        .then_ignore(just(Token::Symbol("}".to_string())))
        .map(|entries| {
            let mut metadata = HashMap::new();
            for (k, v) in entries {
                metadata.insert(k, v);
            }
            metadata
        });

    let map_entry = filter_map(|span, tok| match tok {
        Token::Identifier(k) => Ok(k),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    })
    .then_ignore(just(Token::Symbol(":".to_string())))
    .then_ignore(just(Token::Symbol("[".to_string())))
    .then(filter_map(|span, tok| match tok {
        Token::Number(n) => n.parse::<f64>().map_err(|_| Simple::custom(span, "Invalid number")),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    }))
    .then_ignore(just(Token::Symbol(",".to_string())))
    .then(filter_map(|span, tok| match tok {
        Token::Number(n) => n.parse::<f64>().map_err(|_| Simple::custom(span, "Invalid number")),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    }))
    .then_ignore(just(Token::Symbol("]".to_string())))
    .map(|((k, start), end)| (k, vec![start, end]));

    let map_block = just(Token::MapOpen)
        .ignore_then(map_entry.separated_by(just(Token::Symbol(",".to_string())).or_not()))
        .then_ignore(just(Token::Symbol("}".to_string())))
        .map(|entries| {
            let mut map = HashMap::new();
            for (k, v) in entries {
                map.insert(k, v);
            }
            map
        });

    let def_attr = filter_map(|span, tok| match tok {
        Token::Identifier(k) => Ok(k),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    })
    .then_ignore(just(Token::Symbol("=".to_string())))
    .then(
        filter_map(|span, tok| match tok {
            Token::Identifier(v) => Ok(v),
            Token::String(v) => Ok(v),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }).map(|v| (v, None))
        .or(map_block.map(|m| ("".to_string(), Some(m))))
    );

    let def_parser = just(Token::Keyword("def".to_string()))
        .ignore_then(filter_map(|span, tok| match tok {
            Token::Identifier(i) => Ok(i),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }))
        .then(filter_map(|span, tok| match tok {
            Token::String(s) => Ok(s),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }))
        .then(def_attr.repeated())
        .map(|((id, name), attrs)| {
            let mut style = "standard".to_string();
            let mut patch = "default".to_string();
            let mut src = None;
            let mut map = None;
            for (k, (v, m)) in attrs {
                if k == "style" { style = v; }
                if k == "patch" { patch = v; }
                if k == "src" { src = Some(v); }
                if k == "map" { map = m; }
            }
            crate::ast::Definition {
                id,
                name,
                style,
                patch,
                group: None,
                env: None,
                src,
                tuning: None,
                map,
            }
        });

    meta_block.or_not()
        .then(def_parser.repeated())
        .then(measure_parser().repeated().flatten())
        .map(|((meta_opt, defs), measures)| {
            Ast {
                version: "3.0.0".to_string(),
                imports: Vec::new(),
                vars: HashMap::new(),
                meta: meta_opt.unwrap_or_default(),
                defs,
                macros: Vec::new(),
                measures,
            }
        }).then_ignore(end())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::Token;
    use logos::Logos;

    #[test]
    fn test_def_parser() {
        let input = r#"
        def rh "Right Hand" style=relative patch="gm_piano"
        def concrete_inst "My Sample" style=concrete src="path.wav" map=@{ c4: [0.0, 1.5] }
        measure 1 {
            rh: c4:4
        }
        "#;
        let tokens: Vec<Token> = Token::lexer(input).filter_map(|res| res.ok()).collect();
        let ast = parser().parse(tokens).unwrap();
        assert_eq!(ast.defs.len(), 2);
        assert_eq!(ast.defs[0].id, "rh");
        assert_eq!(ast.defs[0].style, "relative");
        assert_eq!(ast.defs[0].patch, "gm_piano");
        
        assert_eq!(ast.defs[1].id, "concrete_inst");
        assert_eq!(ast.defs[1].style, "concrete");
        assert_eq!(ast.defs[1].src, Some("path.wav".to_string()));
        assert!(ast.defs[1].map.is_some());
        let map = ast.defs[1].map.as_ref().unwrap();
        assert_eq!(map.get("c4"), Some(&vec![0.0, 1.5]));
    }
}
