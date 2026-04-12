import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import Parser from 'web-tree-sitter';

describe('Outer Gauntlet: Semantic Fixes & Syntax Integrity', () => {
    let parser: Parser;

    beforeAll(async () => {
        await Parser.init();
        parser = new Parser();
        const rustLang = await Parser.Language.load(resolve(__dirname, 'infra/parsers/tree-sitter-rust.wasm'));
        parser.setLanguage(rustLang);
    });

    it('guarantees the mutated Rust files contain ZERO syntax errors', () => {
        const filesToVerify = ['tenutoc/src/parser.rs', 'tenutoc/src/engrave/svg.rs', 'tenutoc/src/concrete.rs'];
        
        for (const file of filesToVerify) {
            const sourceCode = readFileSync(file, 'utf8');
            const tree = parser.parse(sourceCode);
            expect(tree.rootNode.hasError()).toBe(false);
        }
    });

    it('verifies all semantic type mismatches were patched', () => {
        const parserRs = readFileSync('tenutoc/src/parser.rs', 'utf8');
        expect(parserRs).toContain('*c == \'.\'');
        expect(parserRs).toContain('*c == \'-\'');
        expect(parserRs).toContain('tuning = Some(v.trim_matches');
        
        const svgRs = readFileSync('tenutoc/src/engrave/svg.rs', 'utf8');
        expect(svgRs).toContain('Event::Spacer(dur, _)');

        const concreteRs = readFileSync('tenutoc/src/concrete.rs', 'utf8');
        expect(concreteRs).not.toContain('arr.num');
        expect(concreteRs).not.toContain('arr[1].den');
    });
});
