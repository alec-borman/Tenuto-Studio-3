import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('Infrastructure: FFI Schema Parity', () => {
    it('verifies the TypeScript worker correctly unwraps the composite Rust AST payload', () => {
        const worker = readFileSync('src/compiler.worker.ts', 'utf8');
        expect(worker).toContain('const parsedPayload = JSON.parse(wasmIrString);');
        expect(worker).toContain('wasmAst = parsedPayload.ast;');
        expect(worker).not.toContain('wasmAst = JSON.parse(wasmIrString);');
    });
});
