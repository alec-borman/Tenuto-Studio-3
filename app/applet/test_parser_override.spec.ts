import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('Rust Compiler: Static AST Override', () => {
    it('purifies the modifier combinator in parser.rs', () => {
        const parser = readFileSync('tenutoc/src/parser.rs', 'utf8');
        expect(parser).toContain('.join("")');
        expect(parser).not.toContain('.join(",")');
    });

    it('injects the zero-duration forward tag in musicxml.rs', () => {
        const xml = readFileSync('tenutoc/src/export/musicxml.rs', 'utf8');
        expect(xml).toContain('<duration>0</duration>');
    });
});
