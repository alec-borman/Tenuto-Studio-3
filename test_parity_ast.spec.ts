import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import Parser from 'web-tree-sitter';

describe('Parity: AST Completeness & Syntax Integrity', () => {
    let parser: Parser;

    beforeAll(async () => {
        await Parser.init();
        parser = new Parser();
        const rustLang = await Parser.Language.load(resolve(__dirname, 'infra/parsers/tree-sitter-rust.wasm'));
        parser.setLanguage(rustLang);
    });

    it('guarantees the mutated Rust files contain ZERO syntax errors', () => {
        const sourceCode = readFileSync('tenutoc/src/parser.rs', 'utf8');
        const tree = parser.parse(sourceCode);
        expect(tree.rootNode.hasError()).toBe(false);
    });

    it('purifies def_parser and root parser to map all attributes', () => {
        const parserRs = readFileSync('tenutoc/src/parser.rs', 'utf8');
        expect(parserRs).not.toMatch(/patch:\s*""\.to_string\(\)/);
        expect(parserRs).not.toMatch(/group:\s*None/);
        expect(parserRs).not.toMatch(/tuning:\s*None/);
        expect(parserRs).not.toMatch(/vars:\s*HashMap::new\(\)/);
        expect(parserRs).not.toMatch(/macros:\s*Vec::new\(\)/);
    });
});
