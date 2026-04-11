const fs = require('fs');
let parser = fs.readFileSync('tenutoc/src/parser.rs', 'utf8');

parser = parser.replace(
    /let env_block = just\(Token::Identifier\(env\.to_string\(\)\)\)/g,
    'let env_block = just(Token::Identifier("env".to_string()))'
);
parser = parser.replace(
    /just\(Token::Symbol\(=.to_string\(\)\)\)/g,
    'just(Token::Symbol("=".to_string()))'
);
parser = parser.replace(
    /just\(Token::Symbol\(,.to_string\(\)\)\)/g,
    'just(Token::Symbol(",".to_string()))'
);
parser = parser.replace(
    /just\(Token::Symbol\(}.to_string\(\)\)\)/g,
    'just(Token::Symbol("}".to_string()))'
);
parser = parser.replace(
    /just\(Token::Symbol\(:\.to_string\(\)\)\)/g,
    'just(Token::Symbol(":".to_string()))'
);

fs.writeFileSync('tenutoc/src/parser.rs', parser);
