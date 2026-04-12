import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import Parser from 'web-tree-sitter';

describe('Parity: SVG Engraver Visual Completeness & Syntax Integrity', () => {
    let parser: Parser;

    beforeAll(async () => {
        await Parser.init();
        parser = new Parser();
        const rustLang = await Parser.Language.load(resolve(__dirname, 'infra/parsers/tree-sitter-rust.wasm'));
        parser.setLanguage(rustLang);
    });

    it('guarantees the mutated Rust files contain ZERO syntax errors', () => {
        const sourceCode = readFileSync('tenutoc/src/engrave/svg.rs', 'utf8');
        const tree = parser.parse(sourceCode);
        expect(tree.rootNode.hasError()).toBe(false);
    });

    it('upgrades render_event to process Rests and Tuplets', () => {
        const svgEngraver = readFileSync('tenutoc/src/engrave/svg.rs', 'utf8');
        expect(svgEngraver).toContain('Event::Rest');
        expect(svgEngraver).toContain('Event::Tuplet');
        
        // Ensure the destructive fallback arm was mitigated
        expect(svgEngraver).not.toMatch(/_\s*=>\s*\{\s*\}/);
    });
});
