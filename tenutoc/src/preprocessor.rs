use crate::ast::Ast;

pub struct Preprocessor {}

impl Preprocessor {
    pub fn new() -> Self {
        Self {}
    }

    pub fn expand(&mut self, ast: Ast) -> Result<Ast, String> {
        Ok(ast)
    }
}
