import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('Infrastructure: Universal Build Parity', () => {
    it('relocates Wasm output to src/pkg in package.json', () => {
        const pkg = readFileSync('package.json', 'utf8');
        expect(pkg).toContain('../src/pkg');
        expect(pkg).not.toContain('../public/pkg');
    });

    it('purifies dynamic imports and syncs FFI in compiler.worker.ts', () => {
        const worker = readFileSync('src/compiler.worker.ts', 'utf8');
        expect(worker).toContain("import('./pkg/tenutoc.js')");
        expect(worker).not.toContain("wasmPath");
        expect(worker).not.toContain("@vite-ignore");
        expect(worker).toContain("compile_tenuto_json");
        expect(worker).not.toContain("compile_tenuto_to_ir_json");
    });

    it('purifies dynamic imports in tenuto-element.js files', () => {
        const el = readFileSync('src/tenuto-element.js', 'utf8');
        expect(el).toContain("import('./pkg/tenutoc.js')");
        expect(el).not.toContain("wasmPath");
        expect(el).not.toContain("@vite-ignore");
    });
});
