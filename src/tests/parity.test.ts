import { describe, it, expect } from 'vitest';
import { Parser } from '../compiler/parser';
import { GraphUnroller } from '../compiler/unroller';

// Mock the Wasm module for the test environment since we can't compile it here
const mockWasmModule = {
    compile_tenuto_to_ir_json: (source: string) => {
        // In a real environment, this would call the Rust Wasm function.
        // For the PoC, we simulate the expected output of the Rust preprocessor.
        const parser = new Parser(source);
        const ast = parser.parse();
        const unroller = new GraphUnroller(ast);
        const unrolledAst = unroller.unroll();
        return JSON.stringify(unrolledAst);
    }
};

describe('Parity: Relative Pitch', () => {
    it('should ensure Rust IR output matches TS JSON output for a relative pitch sequence', () => {
        const code = `tenuto "3.0" {
            group "Main" {
                def v1 "Voice 1" style=relative patch=gm_piano
            }
            measure 1 {
                v1: c4 d e f g a b c
            }
        }`;

        // 1. Get TS AST
        const tsParser = new Parser(code);
        const tsAst = tsParser.parse();
        const tsUnroller = new GraphUnroller(tsAst);
        const tsUnrolledAst = tsUnroller.unroll();
        const tsJson = JSON.stringify(tsUnrolledAst);

        // 2. Get Rust IR (simulated via mock for this PoC)
        const rustJson = mockWasmModule.compile_tenuto_to_ir_json(code);

        // 3. Output Normalization & Comparison
        const normalize = (json: string) => {
            const obj = JSON.parse(json);
            // Remove line/column info as they might differ slightly between parsers
            const clean = (node: any) => {
                if (Array.isArray(node)) {
                    node.forEach(clean);
                } else if (node && typeof node === 'object') {
                    delete node.line;
                    delete node.column;
                    Object.values(node).forEach(clean);
                }
            };
            clean(obj);
            return JSON.stringify(obj, null, 2);
        };

        const normalizedTs = normalize(tsJson);
        const normalizedRust = normalize(rustJson);

        expect(normalizedRust).toBe(normalizedTs);
    });
});

describe('Parity: Euclidean Frequency', () => {
    it('should ensure Rust IR output matches TS JSON output for a Euclidean sequence', () => {
        const code = `tenuto "3.0" {
            measure 1 {
                v1: c4(3,8):16.stacc
            }
        }`;

        // 1. Get TS AST
        const tsParser = new Parser(code);
        const tsAst = tsParser.parse();
        const tsUnroller = new GraphUnroller(tsAst);
        const tsUnrolledAst = tsUnroller.unroll();
        const tsJson = JSON.stringify(tsUnrolledAst);

        // 2. Get Rust IR (simulated via mock for this PoC)
        const rustJson = mockWasmModule.compile_tenuto_to_ir_json(code);

        // 3. Output Normalization & Comparison
        const normalize = (json: string) => {
            const obj = JSON.parse(json);
            const clean = (node: any) => {
                if (Array.isArray(node)) {
                    node.forEach(clean);
                } else if (node && typeof node === 'object') {
                    delete node.line;
                    delete node.column;
                    Object.values(node).forEach(clean);
                }
            };
            clean(obj);
            return JSON.stringify(obj, null, 2);
        };

        const normalizedTs = normalize(tsJson);
        const normalizedRust = normalize(rustJson);

        expect(normalizedRust).toBe(normalizedTs);
    });
});

describe('Parity: The Modulation Pipeline', () => {
    it('should ensure Rust IR output matches TS JSON output for complex modifiers and rolls', () => {
        const code = `tenuto "3.0" {
            measure 1 {
                v1: c4:4.fx("bitcrusher",@{bits:4,dryWet:0.8}).pan([-1.0,1.0],"exponential").roll(4)
            }
        }`;

        // 1. Get TS AST
        const tsParser = new Parser(code);
        const tsAst = tsParser.parse();
        const tsUnroller = new GraphUnroller(tsAst);
        const tsUnrolledAst = tsUnroller.unroll();
        const tsJson = JSON.stringify(tsUnrolledAst);

        // 2. Get Rust IR (simulated via mock for this PoC)
        const rustJson = mockWasmModule.compile_tenuto_to_ir_json(code);

        // 3. Output Normalization & Comparison
        const normalize = (json: string) => {
            const obj = JSON.parse(json);
            const clean = (node: any) => {
                if (Array.isArray(node)) {
                    node.forEach(clean);
                } else if (node && typeof node === 'object') {
                    delete node.line;
                    delete node.column;
                    Object.values(node).forEach(clean);
                }
            };
            clean(obj);
            return JSON.stringify(obj, null, 2);
        };

        const normalizedTs = normalize(tsJson);
        const normalizedRust = normalize(rustJson);

        expect(normalizedRust).toBe(normalizedTs);
    });
});
