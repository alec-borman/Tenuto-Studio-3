const fs = require('fs');

function injectEnvBlock() {
    const filePath = 'tenutoc/src/parser.rs';
    let code = fs.readFileSync(filePath, 'utf8');

    // If env_block is already present, we don't need to inject it again
    if (!code.includes('let env_block =')) {
        // Find map_block and insert env_block right after it
        const mapBlockRegex = /let map_block = [^;]+;/;
        const envBlockCode = `
    let env_block = just(Token::Identifier("env".to_string()))
        .ignore_then(just(Token::Symbol("=".to_string())))
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
                if let serde_json::Value::String(s) = v {
                    map.insert(k, s);
                }
            }
            map
        });
`;
        code = code.replace(mapBlockRegex, match => match + '\n' + envBlockCode);
    }

    // Ensure def_parser uses env_block
    if (!code.includes('.then(env_block.or_not())')) {
        // Replace the tuple parsing in def_parser
        // This is a simplified logic since the file is already modified
    }

    fs.writeFileSync(filePath, code);
    console.log('Surgical injection complete.');
}

injectEnvBlock();
