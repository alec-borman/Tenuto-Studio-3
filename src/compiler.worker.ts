import { Parser, ParserError } from './compiler/parser';
import { SemanticAnalyzer, SemanticError } from './compiler/analyzer';
import { SVGEngraver } from './engraver/svg';
import init, { compile_tenuto_to_midi, compile_tenuto_to_svg, decompile_midi_to_tenuto, alloc_buffer, free_buffer, decompile_midi_zero_copy } from '../public/pkg/tenutoc.js';

let isWasmLoaded = false;
let wasmMemory: any = null;

async function bootCompiler() {
    try {
        const startTime = performance.now();
        const wasm = await init(); 
        if (wasm && wasm.memory) {
            wasmMemory = wasm.memory;
        }
        const bootTime = performance.now() - startTime;
        isWasmLoaded = true;
        
        postMessage({ 
            type: 'STATUS', 
            status: 'READY',
            bootTime: bootTime.toFixed(2)
        });
    } catch (e: any) {
        postMessage({ 
            type: 'STATUS', 
            status: 'ERROR', 
            error: e.toString() 
        });
    }
}

bootCompiler();

self.onmessage = async (e) => {
    if (!isWasmLoaded) {
        postMessage({ 
            type: 'ERROR', 
            payload: { message: "Compiler is still booting. Please wait." } 
        });
        return;
    }

    const { type, code, midi_bytes } = e.data;

    if (type === 'CODE_CHANGED') {
        if (!code || code.trim() === '') {
            postMessage({ type: 'ERROR', payload: { message: "Source code is empty." } });
            return;
        }

        const compileStartTime = performance.now();

        try {
            // 1. Run our TS Parser and Semantic Analyzer
            const parser = new Parser(code);
            const ast = parser.parse();
            
            const analyzer = new SemanticAnalyzer(ast);
            const semanticErrors = analyzer.analyze();
            
            if (semanticErrors.length > 0) {
                // Return semantic errors
                const diagnostics = semanticErrors.map(err => ({
                    line: err.line,
                    column: err.column,
                    message: err.message,
                    severity: 'error'
                }));
                
                postMessage({ 
                    type: 'ERROR', 
                    payload: { 
                        message: "Semantic analysis failed",
                        diagnostics
                    } 
                });
                return;
            }

            // 2. If valid, run the WASM compiler (mocked) to generate MIDI and SVG
            const midiBytes = compile_tenuto_to_midi(code);
            
            // Use our new TS-based engraver
            const engraver = new SVGEngraver();
            const svgString = engraver.render(ast);
            
            const compileDuration = performance.now() - compileStartTime;
            
            postMessage({ 
                type: 'SUCCESS', 
                payload: { 
                    midi: midiBytes,
                    svg: svgString,
                    durationMs: compileDuration.toFixed(2)
                } 
            });
            
        } catch (err: any) {
            let diagnostics = [];
            if (err instanceof ParserError) {
                diagnostics.push({
                    line: err.line,
                    column: err.column,
                    message: err.message,
                    severity: 'error'
                });
            } else {
                diagnostics.push({
                    line: 1,
                    column: 1,
                    message: err.toString(),
                    severity: 'error'
                });
            }
            
            postMessage({ 
                type: 'ERROR', 
                payload: { 
                    message: err.toString(),
                    diagnostics
                } 
            });
        }
    } else if (type === 'DECOMPILE') {
        try {
            let tenutoCode;
            const midiBytesArray = new Uint8Array(midi_bytes);
            
            if (wasmMemory && typeof alloc_buffer === 'function' && typeof free_buffer === 'function' && typeof decompile_midi_zero_copy === 'function') {
                const len = midiBytesArray.length;
                const ptr = alloc_buffer(len);
                
                const memoryView = new Uint8Array(wasmMemory.buffer, ptr, len);
                memoryView.set(midiBytesArray);
                
                tenutoCode = decompile_midi_zero_copy(ptr, len);
                
                free_buffer(ptr, len);
            } else {
                tenutoCode = decompile_midi_to_tenuto(midiBytesArray);
            }

            postMessage({
                type: 'DECOMPILE_SUCCESS',
                payload: {
                    code: tenutoCode
                }
            });
        } catch (err: any) {
            postMessage({
                type: 'ERROR',
                payload: {
                    message: err.toString()
                }
            });
        }
    }
};
