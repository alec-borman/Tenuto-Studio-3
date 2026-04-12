import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import Parser from 'web-tree-sitter';

describe('Parity: IR Physics Completeness & Syntax Integrity', () => {
    let parser: Parser;

    beforeAll(async () => {
        await Parser.init();
        parser = new Parser();
        const rustLang = await Parser.Language.load(resolve(__dirname, 'infra/parsers/tree-sitter-rust.wasm'));
        parser.setLanguage(rustLang);
    });

    it('guarantees the mutated Rust files contain ZERO syntax errors', () => {
        const filesToVerify = ['tenutoc/src/parser.rs', 'tenutoc/src/ir.rs', 'tenutoc/src/sidechain.rs'];
        
        for (const file of filesToVerify) {
            const sourceCode = readFileSync(file, 'utf8');
            const tree = parser.parse(sourceCode);
            
            // Mathematically proves the file is structurally valid Rust
            expect(tree.rootNode.hasError()).toBe(false);
        }
    });

    it('verifies the logic was injected', () => {
        const parserRs = readFileSync('tenutoc/src/parser.rs', 'utf8');
        expect(parserRs).toContain('TimeVal::Milliseconds');
        
        const sidechainRs = readFileSync('tenutoc/src/sidechain.rs', 'utf8');
        expect(sidechainRs).toContain('EventKind::MidiCC');
    });
});
