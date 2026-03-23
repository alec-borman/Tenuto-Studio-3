use logos::Logos;

#[derive(Logos, Hash, Eq, PartialEq, Clone, Debug)]
#[logos(skip r"[ \t\n\f]+")]
pub enum Token {
    #[regex(r"[0-9]+(/[0-9]+)?", |lex| lex.slice().to_string())]
    Number(String),

    #[regex(r"[a-zA-Z_][a-zA-Z0-9_+\-^v#]*", |lex| lex.slice().to_string())]
    Identifier(String),

    #[regex(r"[{}@=:<\[\]|,\(\)*.]", |lex| lex.slice().to_string())]
    Symbol(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use logos::Logos;
    use proptest::prelude::*;

    #[test]
    fn test_strict_token_isolation() {
        // This tests the F-002 Bug Fix. 
        // 4.stacc.ff MUST be parsed as Number(4), Symbol(.), Identifier(stacc), Symbol(.), Identifier(ff)
        let source = "rh: [c#5 eb5]:4.stacc.ff |";
        let lexer = Token::lexer(source);

        let expected = vec![
            Token::Identifier("rh".to_string()),
            Token::Symbol(":".to_string()),
            Token::Symbol("[".to_string()),
            Token::Identifier("c#5".to_string()), 
            Token::Identifier("eb5".to_string()),
            Token::Symbol("]".to_string()),
            Token::Symbol(":".to_string()),
            Token::Number("4".to_string()),
            Token::Symbol(".".to_string()),
            Token::Identifier("stacc".to_string()),
            Token::Symbol(".".to_string()),
            Token::Identifier("ff".to_string()),
            Token::Symbol("|".to_string()),
        ];

        let actual: Vec<Token> = lexer.filter_map(Result::ok).collect();
        assert_eq!(actual, expected, "Lexer failed to isolate dots from identifiers/numbers.");
    }

    // Property-based testing: Throw random garbage at the lexer to ensure it NEVER panics.
    proptest! {
        #[test]
        fn lexer_never_panics_on_random_input(s in "\\PC*") {
            let mut lexer = Token::lexer(&s);
            while let Some(_) = lexer.next() {
                // We don't care if it's Ok or Err, we just care that it doesn't panic.
            }
        }
    }
}
