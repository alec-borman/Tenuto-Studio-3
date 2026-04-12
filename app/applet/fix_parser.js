const fs = require('fs');
let parser = fs.readFileSync('/app/applet/tenutoc/src/parser.rs', 'utf8');

const oldParserFunc = parser.substring(parser.indexOf('pub fn parser() -> impl Parser<Token, Ast, Error = Simple<Token>> {'));

const newParserFunc = `pub fn parser() -> impl Parser<Token, Ast, Error = Simple<Token>> {
    let meta_value = filter_map(|span, tok| match tok {
        Token::String(s) => Ok(serde_json::Value::String(s)),
        Token::Number(n) => {
            if n.contains('/') {
                Ok(serde_json::Value::String(n))
            } else {
                Ok(serde_json::Value::Number(serde_json::Number::from_f64(n.parse().unwrap_or(0.0)).unwrap()))
            }
        },
        Token::Identifier(i) => {
            if i == "true" { Ok(serde_json::Value::Bool(true)) }
            else if i == "false" { Ok(serde_json::Value::Bool(false)) }
            else { Ok(serde_json::Value::String(i)) }
        },
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    });

    let meta_block = just(Token::Keyword("meta".to_string()))
        .ignore_then(just(Token::Symbol("@".to_string())))
        .ignore_then(just(Token::Symbol("{".to_string())))
        .ignore_then(
            filter_map(|span, tok| match tok {
                Token::Identifier(i) => Ok(i),
                _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
            })
            .then_ignore(just(Token::Symbol(":".to_string())))
            .then(meta_value.clone())
            .separated_by(just(Token::Symbol(",".to_string())))
        )
        .then_ignore(just(Token::Symbol("}".to_string())))
        .map(|kvs| {
            let mut map = HashMap::new();
            for (k, v) in kvs {
                map.insert(k, v);
            }
            map
        });

    let var_parser = just(Token::Keyword("var".to_string()))
        .ignore_then(filter_map(|span, tok| match tok {
            Token::Identifier(i) => Ok(i),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }))
        .then_ignore(just(Token::Symbol("=".to_string())))
        .then(filter_map(|span, tok| match tok {
            Token::String(s) => Ok(s),
            Token::Number(n) => Ok(n),
            Token::Identifier(i) => Ok(i),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }));

    let macro_parser = filter_map(|span, tok| match tok {
        Token::Identifier(i) if i.starts_with('$') => Ok(i),
        _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
    })
    .then_ignore(just(Token::Symbol("=".to_string())))
    .then_ignore(just(Token::Symbol("{".to_string())))
    .then(event_parser().repeated().map(|vecs| vecs.into_iter().flatten().collect()))
    .then_ignore(just(Token::Symbol("}".to_string())))
    .map(|(id, events)| MacroDef { id, events });

    let tenuto_header = just(Token::Keyword("tenuto".to_string()))
        .ignore_then(filter_map(|span, tok| match tok {
            Token::String(s) => Ok(s),
            _ => Err(Simple::expected_input_found(span, Vec::new(), Some(tok))),
        }))
        .then_ignore(just(Token::Symbol("{".to_string())));

    tenuto_header.or_not()
        .ignore_then(var_parser.repeated())
        .then(meta_block.or_not())
        .then(macro_parser.repeated())
        .then(def_parser().repeated())
        .then(measure_parser().repeated().flatten())
        .then_ignore(just(Token::Symbol("}".to_string())).or_not())
        .map(|(((((vars_vec, meta_opt), macros), defs), measures)| {
            let mut vars = HashMap::new();
            for (k, v) in vars_vec {
                vars.insert(k, v);
            }
            Ast {
                version: "3.0.0".to_string(),
                imports: Vec::new(),
                vars,
                meta: meta_opt.unwrap_or_default(),
                defs,
                macros,
                deterministics: Vec::new(),
                sustainability: Vec::new(),
                measures,
            }
        }).then_ignore(end())
}`;

parser = parser.replace(oldParserFunc, newParserFunc);
fs.writeFileSync('/app/applet/tenutoc/src/parser.rs', parser);
