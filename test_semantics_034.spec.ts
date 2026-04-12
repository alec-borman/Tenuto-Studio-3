import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import Parser from 'web-tree-sitter';

describe('Outer Gauntlet: E0004 Resolution & Warning Hygiene', () => {
    let parser: Parser;

    beforeAll(async () => {
        await Parser.init();
        parser = new Parser();
        const rustLang = await Parser.Language.load(resolve(__dirname, 'infra/parsers/tree-sitter-rust.wasm'));
        parser.setLanguage(rustLang);
    });

    it('guarantees the mutated Rust files contain ZERO syntax errors', () => {
        const filesToVerify = [
            'tenutoc/src/engrave/svg.rs',
            'tenutoc/src/export/musicxml.rs',
            'tenutoc/src/concrete.rs',
            'tenutoc/src/engrave/kurbo.rs',
            'tenutoc/src/engrave/layout.rs'
        ];
        
        for (const file of filesToVerify) {
            const sourceCode = readFileSync(file, 'utf8');
            const tree = parser.parse(sourceCode);
            expect(tree.rootNode.hasError()).toBe(false, `${file} contains a syntax error after mutation.`);
        }
    });

    it('verifies the exhaustive match arm and variable prefixes were injected', () => {
        const svgRs = readFileSync('tenutoc/src/engrave/svg.rs', 'utf8');
        expect(svgRs).toContain('Event::Euclidean(_, _, _) =>');
        
        const kurboRs = readFileSync('tenutoc/src/engrave/kurbo.rs', 'utf8');
        expect(kurboRs).toContain('let mut _max_violation = 0.0');
        expect(kurboRs).toContain('let mut _max_violation_t = 0.0');

        const layoutRs = readFileSync('tenutoc/src/engrave/layout.rs', 'utf8');
        expect(layoutRs).toContain('let mut _cost = 0.0');
    });
});
