import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import Parser from 'web-tree-sitter';

describe('Outer Gauntlet: Scope Restoration & Warning Hygiene', () => {
    let parser: Parser;

    beforeAll(async () => {
        await Parser.init();
        parser = new Parser();
        const rustLang = await Parser.Language.load(resolve(__dirname, 'infra/parsers/tree-sitter-rust.wasm'));
        parser.setLanguage(rustLang);
    });

    it('guarantees the mutated Rust files contain ZERO syntax errors', () => {
        const filesToVerify = [
            'tenutoc/src/engrave/layout.rs',
            'tenutoc/src/engrave/svg.rs'
        ];
        
        for (const file of filesToVerify) {
            const sourceCode = readFileSync(file, 'utf8');
            const tree = parser.parse(sourceCode);
            expect(tree.rootNode.hasError()).toBe(false, `${file} contains a syntax error after mutation.`);
        }
    });

    it('verifies the scope was restored and unused variables prefixed', () => {
        const layoutRs = readFileSync('tenutoc/src/engrave/layout.rs', 'utf8');
        expect(layoutRs).toContain('let mut cost = 0.0;');
        expect(layoutRs).not.toContain('let mut _cost = 0.0;');
        
        const svgRs = readFileSync('tenutoc/src/engrave/svg.rs', 'utf8');
        expect(svgRs).toContain('Event::Rest(_dur)');
        expect(svgRs).toContain('Event::Spacer(_dur, _)');
        expect(svgRs).toContain('Event::Tuplet(_events, ratio)');
    });
});
