use chumsky::prelude::*;
use crate::lexer::Token;
use crate::ast::Ast;

pub fn parser() -> impl Parser<Token, Ast, Error = Simple<Token>> {
    empty().to(Ast {})
}
