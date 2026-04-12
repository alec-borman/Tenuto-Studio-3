import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import Parser from 'web-tree-sitter';

describe('Parity: AST Null-Safety & TimeVal Integration', () => {
    let parser: Parser;

    beforeAll(async () => {
        await Parser.init();
        parser = new Parser();
        const rustLang = await Parser.Language.load(resolve(__dirname, 'infra/parsers/tree-sitter-rust.wasm'));
        parser.setLanguage(rustLang);
    });

    it('guarantees the mutated Rust files contain ZERO syntax errors', () => {
        const files = ['tenutoc/src/ast.rs', 'tenutoc/src/parser.rs'];
        for (const file of files) {
            const sourceCode = readFileSync(file, 'utf8');
            const tree = parser.parse(sourceCode);
            expect(tree.rootNode.hasError()).toBe(false, `${file} contains a syntax error.`);
        }
    });

    it('verifies non-optional HashMaps and TimeVal parsing were injected', () => {
        const astRs = readFileSync('tenutoc/src/ast.rs', 'utf8');
        expect(astRs).toContain('pub meta: HashMap<String, String>');
        expect(astRs).not.toContain('pub meta: Option<HashMap<String, String>>');

        const parserRs = readFileSync('tenutoc/src/parser.rs', 'utf8');
        expect(parserRs).toContain('Token::TimeVal');
        expect(parserRs).toContain('.unwrap_or_default()');
    });
});
