use tenutoc::lexer::{Token};
use logos::Logos;

#[test]
fn test_lex() {
    let source = "vox: A:2.slice(8)";
    let tokens: Vec<_> = Token::lexer(source).collect();
    println!("{:?}", tokens);
    panic!("show output");
}
