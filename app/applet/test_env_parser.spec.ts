import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

// Implementer: Write this file to test_env_parser.spec.ts
// You MUST ONLY run it via `npx vitest run test_env_parser.spec.ts`
describe('Rust Compiler: Env Map Sigil Parsing', () => {
    it('purifies def_parser to handle env=@{...}', () => {
        const parser = readFileSync('tenutoc/src/parser.rs', 'utf8');
        expect(parser).toContain('env_block');
        expect(parser).toContain('Token::Identifier("env"');
        
        // Verify hardcoded None was replaced
        expect(parser).not.toMatch(/env:\s*None/);
    });
});
