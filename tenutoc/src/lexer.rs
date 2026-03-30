use logos::{Logos, Lexer};

/// The Token enum represents the lexical tokens of the Tenuto language.
/// 
/// F-002 Bug Fix: The lexer implements strict dot isolation for attributes.
/// For example, `4.stacc` is parsed as `Number("4")`, `Symbol(".")`, `Identifier("stacc")`
/// rather than incorrectly consuming the dot as part of a floating-point number.
#[derive(Logos, Hash, Eq, PartialEq, Clone, Debug)]
#[regex(r"\s+", logos::skip, priority = 2)]
#[regex(r"//[^\n]*", logos::skip, priority = 2)]
#[regex(r"%%[^\n]*", logos::skip, priority = 2)]
pub enum Token {
    #[token("tenuto", |lex| lex.slice().to_string())]
    #[token("meta", |lex| lex.slice().to_string())]
    #[token("def", |lex| lex.slice().to_string())]
    #[token("measure", |lex| lex.slice().to_string())]
    #[token("group", |lex| lex.slice().to_string())]
    #[token("import", |lex| lex.slice().to_string())]
    #[token("repeat", |lex| lex.slice().to_string())]
    #[token("var", |lex| lex.slice().to_string())]
    Keyword(String),

    #[token("<[")]
    VoiceOpen,

    #[token("]>")]
    VoiceClose,

    #[token("@{")]
    MapOpen,

    #[regex(r"[0-9]+(\.[0-9]+)?(ms|s|ticks)", |lex| lex.slice().to_string(), priority = 2)]
    TimeVal(String),

    #[regex(r"[a-zA-Z_$\+\-#^][a-zA-Z0-9_$\+\-#^]*", |lex| lex.slice().to_string(), priority = 2)]
    Identifier(String),

    #[regex(r"[0-9]+", lex_number, priority = 2)]
    Number(String),

    #[regex(r#""[^"]*""#, |lex| {
        let s = lex.slice();
        s[1..s.len()-1].to_string()
    })]
    String(String),

    #[token("|:", |lex| lex.slice().to_string())]
    #[token(":|", |lex| lex.slice().to_string())]
    #[token("[1.", |lex| lex.slice().to_string())]
    #[token("[2.", |lex| lex.slice().to_string())]
    #[regex(r"[^\s\w]", |lex| lex.slice().to_string(), priority = 1)]
    Symbol(String),
}

fn lex_number(lex: &mut Lexer<Token>) -> String {
    loop {
        let remainder = lex.remainder();
        let mut chars = remainder.chars();
        let Some(c) = chars.next() else { break };

        if c.is_ascii_digit() || c == '/' {
            lex.bump(c.len_utf8());
        } else if c == '.' {
            // F-002 Fix: check if it's an accessor
            let next_c = chars.next();
            let is_accessor = match next_c {
                Some(nc) => matches!(nc, 'a'..='z' | 'A'..='Z' | '_' | '$' | '+' | '-' | '#' | '^'),
                None => false,
            };
            if is_accessor {
                break; // Do not consume the dot
            } else {
                lex.bump(1);
            }
        } else {
            break;
        }
    }

    // Units
    let remainder = lex.remainder();
    if remainder.starts_with("ms") {
        lex.bump(2);
    } else if remainder.starts_with("s") {
        let after_s = &remainder[1..];
        if !after_s.starts_with(|c: char| c.is_ascii_alphabetic()) {
            lex.bump(1);
        }
    } else if remainder.starts_with("ticks") {
        lex.bump(5);
    } else if remainder.starts_with('%') {
        lex.bump(1);
    }

    lex.slice().to_string()
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

    #[test]
    fn test_timeval_and_sigils() {
        let source = "<[ v1: c4:4.pull(15ms) ]> @{";
        let lexer = Token::lexer(source);

        let expected = vec![
            Token::VoiceOpen,
            Token::Identifier("v1".to_string()),
            Token::Symbol(":".to_string()),
            Token::Identifier("c4".to_string()),
            Token::Symbol(":".to_string()),
            Token::Number("4".to_string()),
            Token::Symbol(".".to_string()),
            Token::Identifier("pull".to_string()),
            Token::Symbol("(".to_string()),
            Token::TimeVal("15ms".to_string()),
            Token::Symbol(")".to_string()),
            Token::VoiceClose,
            Token::MapOpen,
        ];

        let actual: Vec<Token> = lexer.filter_map(Result::ok).collect();
        assert_eq!(actual, expected, "Lexer failed to parse TimeVal or compound sigils.");
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
