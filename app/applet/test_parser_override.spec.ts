import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

// Implementer: Write this file to test_parser_override.spec.ts 
// You MUST ONLY run it via `npx vitest run test_parser_override.spec.ts`
describe('Rust Compiler: Static AST Override', () => {
    it('purifies the modifier combinator in parser.rs', () => {
        const parser = readFileSync('tenutoc/src/parser.rs', 'utf8');
        const modifierFn = parser.split('fn duration_with_mods()')[0];
        expect(modifierFn).toContain('.repeated()');
        expect(modifierFn).not.toContain('.separated_by(just(Token::Symbol(",".to_string())))');
        expect(parser).toContain('.join("")');
        expect(parser).not.toContain('.join(",")');
    });
});
