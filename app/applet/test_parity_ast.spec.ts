import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('Parity: AST Completeness', () => {
    it('purifies def_parser and root parser to map all attributes', () => {
        const parser = readFileSync('tenutoc/src/parser.rs', 'utf8');
        expect(parser).not.toMatch(/patch:\s*""\.to_string\(\)/);
        expect(parser).not.toMatch(/group:\s*None/);
        expect(parser).not.toMatch(/tuning:\s*None/);
        expect(parser).not.toMatch(/vars:\s*HashMap::new\(\)/);
        expect(parser).not.toMatch(/macros:\s*Vec::new\(\)/);
    });
});
