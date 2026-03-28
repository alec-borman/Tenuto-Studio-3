use crate::parser::*;
use crate::lexer::*;
use logos::Logos;

#[test]
fn test_modifier() {
    let code = "c4:4.fx(\"bitcrusher\",@{bits:4,dryWet:0.8}).pan([-1.0,1.0],\"exponential\").roll(4)";
    let tokens: Vec<_> = Token::lexer(code).map(|tok| tok.unwrap()).collect();
    println!("{:?}", tokens);
}
