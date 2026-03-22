import { Parser, ParserError, AST } from './compiler/parser';
import { SemanticAnalyzer, SemanticError } from './compiler/analyzer';
import { Linter } from './compiler/linter';
import { SVGEngraver } from './engraver/svg';
import init, { compile_tenuto_to_svg, decompile_midi_to_tenuto, alloc_buffer, free_buffer, decompile_midi_zero_copy } from '../public/pkg/tenutoc.js';
import { STDLIB } from './compiler/stdlib';
import { MusicXMLExporter } from './compiler/musicxml';
import { MIDIGenerator } from './compiler/midi';
import { CompilerError } from './compiler/diagnostics';
import { AudioEventGenerator } from './compiler/audio';
import { GraphUnroller } from './compiler/unroller';

let isWasmLoaded = false;
let wasmMemory: any = null;

function mergeASTs(main: AST, imported: AST): AST {
  return {
    version: main.version,
    imports: main.imports,
    meta: { ...imported.meta, ...main.meta },
    defs: [...imported.defs, ...main.defs],
    macros: [...imported.macros, ...main.macros],
    measures: main.measures
  };
}

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

    const { type, code, midi_bytes, tempoOverride } = e.data;

    if (type === 'CODE_CHANGED') {
        if (!code || code.trim() === '') {
            postMessage({ type: 'ERROR', payload: { message: "Source code is empty." } });
            return;
        }

        let processedCode = code;
        if (!processedCode.includes('tenuto "3.0"')) {
            processedCode = `tenuto "3.0" {
  meta @{ title: "Sketch", tempo: 120, time: "4/4" }
  group "Main" {
    def v1 "Voice 1" style=standard patch=gm_piano
  }
  measure 1 {
    v1: ${processedCode}
  }
}`;
        }

        const compileStartTime = performance.now();

        try {
            // 1. Run our TS Parser and Semantic Analyzer
            const parser = new Parser(processedCode);
            let ast = parser.parse();
            
            // Apply tempo override if provided (Sprint 5: Ableton Link)
            if (tempoOverride) {
                ast.meta.tempo = tempoOverride;
            }
            
            // Resolve imports
            if (ast.imports && ast.imports.length > 0) {
                for (const importPath of ast.imports) {
                    if (STDLIB[importPath]) {
                        const importedParser = new Parser(STDLIB[importPath]);
                        const importedAst = importedParser.parse();
                        ast = mergeASTs(ast, importedAst);
                    } else {
                        throw new ParserError(`Module not found: ${importPath}`, 1, 1);
                    }
                }
            }

            // Sprint 6: Graph Unrolling
            const unroller = new GraphUnroller(ast);
            const unrolledAst = unroller.unroll();

            const analyzer = new SemanticAnalyzer(unrolledAst);
            const semanticErrors = analyzer.analyze();
            
            if (semanticErrors.length > 0) {
                // Return semantic errors
                const diagnostics = semanticErrors.map(err => err.diagnostic);
                
                postMessage({ 
                    type: 'ERROR', 
                    payload: { 
                        message: "Semantic analysis failed",
                        diagnostics
                    } 
                });
                return;
            }

            const linter = new Linter();
            const lintDiagnostics = linter.lint(ast);

            // 2. If valid, run the TS compiler to generate MIDI and SVG
            const midiGen = new MIDIGenerator();
            const midiBytes = midiGen.generate(unrolledAst);
            
            // Generate audio events directly from AST
            const audioGen = new AudioEventGenerator();
            const audioEvents = audioGen.generate(unrolledAst);
            
            // Use our new TS-based engraver
            const engraver = new SVGEngraver();
            const { svgs: svgStrings, layout: scoreLayout } = engraver.render(ast, lintDiagnostics);
            
            const musicxmlExporter = new MusicXMLExporter();
            const musicxml = musicxmlExporter.export(unrolledAst);
            
            const compileDuration = performance.now() - compileStartTime;
            
            postMessage({ 
                type: 'SUCCESS', 
                payload: { 
                    midi: midiBytes,
                    audioEvents: audioEvents,
                    svgs: svgStrings,
                    layout: scoreLayout,
                    musicxml: musicxml,
                    ast: unrolledAst,
                    ir: JSON.stringify(unrolledAst),
                    rawCode: processedCode,
                    durationMs: compileDuration.toFixed(2),
                    diagnostics: lintDiagnostics
                } 
            });
            
        } catch (err: any) {
            let diagnostics = [];
            if (err instanceof CompilerError) {
                diagnostics.push(err.diagnostic);
            } else {
                diagnostics.push({
                    status: 'fatal',
                    code: 'E0000',
                    type: 'Internal Compiler Error',
                    location: { line: 1, column: 1 },
                    diagnostics: {
                        message: err.toString()
                    }
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
                
                // 1. Allocate memory inside the Rust Wasm instance
                const ptr = alloc_buffer(len);
                
                // 2. Create a view into that specific memory block and copy our MIDI bytes in
                const memoryView = new Uint8Array(wasmMemory.buffer, ptr, len);
                memoryView.set(midiBytesArray);
                
                // 3. Tell Rust to decompile the bytes at that pointer
                tenutoCode = decompile_midi_zero_copy(ptr, len);
                
                // 4. Free the memory to prevent leaks
                free_buffer(ptr, len);
            } else {
                throw new Error("WASM Memory or Zero-Copy functions are not securely linked.");
            }

            postMessage({
                type: 'DECOMPILE_SUCCESS',
                payload: { code: tenutoCode }
            });
        } catch (err: any) {
            postMessage({
                type: 'ERROR',
                payload: { message: err.toString() }
            });
        }
    }
};
