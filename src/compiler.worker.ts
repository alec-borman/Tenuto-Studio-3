import { Parser, ParserError, AST } from './compiler/parser';
import { SemanticAnalyzer, SemanticError } from './compiler/analyzer';
import { Linter } from './compiler/linter';
import { SVGEngraver } from './engraver/svg';
import { STDLIB } from './compiler/stdlib';
import { MusicXMLExporter } from './compiler/musicxml';
import { MIDIGenerator } from './compiler/midi';
import { CompilerError } from './compiler/diagnostics';
import { AudioEventGenerator } from './compiler/audio';
import { GraphUnroller } from './compiler/unroller';

export interface StandardCompilerResponse {
    midi: Uint8Array;
    audioEvents: any[];
    svgs: string[];
    layout: any;
    musicxml: string;
    ast: any;
    ir: string;
    rawCode: string;
    durationMs: string;
    diagnostics: any[];
}

export interface CompilerRequest {
    type: 'CODE_CHANGED' | 'DECOMPILE';
    code?: string;
    tempoOverride?: number;
    midi_bytes?: Uint8Array;
}

export interface CompilerResponse {
    type: 'STATUS' | 'SUCCESS' | 'ERROR' | 'DECOMPILE_SUCCESS';
    status?: string;
    error?: string;
    payload?: StandardCompilerResponse | any;
    bootTime?: string;
}

function mergeASTs(main: AST, imported: AST): AST {
  return {
    version: main.version,
    imports: main.imports,
    vars: { ...imported.vars, ...main.vars },
    meta: { ...imported.meta, ...main.meta },
    defs: [...imported.defs, ...main.defs],
    macros: [...imported.macros, ...main.macros],
    measures: main.measures
  };
}

let activeEngine: 'TYPESCRIPT' | 'WASM' = 'TYPESCRIPT';
let wasmCore: any = null;
const DEBUG_PARITY = false;

async function bootCompiler() {
    try {
        const startTime = performance.now();
        
        // Task 2: Wasm Worker Connectivity (Production Fix #1)
        try {
            // @ts-ignore
            const wasmPath = '/pkg/tenutoc.js';
            const wasmModule = await import(/* @vite-ignore */ wasmPath);
            // @ts-ignore
            await wasmModule.default(); 
            wasmCore = wasmModule;
            activeEngine = 'WASM';
            console.log("[TEDP] Wasm Steel Track Connected.");
        } catch (e) {
            console.warn("[TEDP] Wasm Steel Track failed to connect. Falling back to TS Simulation.", e);
        }

        const bootTime = performance.now() - startTime;
        
        const response: CompilerResponse = { 
            type: 'STATUS', 
            status: 'READY',
            bootTime: bootTime.toFixed(2)
        };
        postMessage(response);
    } catch (e: any) {
        const response: CompilerResponse = { 
            type: 'STATUS', 
            status: 'ERROR', 
            error: e.toString() 
        };
        postMessage(response);
    }
}

bootCompiler();

self.onmessage = async (e: MessageEvent<CompilerRequest>) => {
    const { type, code, midi_bytes, tempoOverride } = e.data;

    if (type === 'CODE_CHANGED') {
        if (!code || code.trim() === '') {
            const response: CompilerResponse = { type: 'ERROR', payload: { message: "Source code is empty." } };
            postMessage(response);
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
        
        let wasmDiagnostics: any[] = [];
        let wasmSuccess = false;
        let wasmAst: any = null;
        let wasmIrString: string = "";

        // Track B: Defensive Wasm (Production Track)
        // We assume the Wasm binary might be out of sync or return raw strings
        try {
            if (activeEngine === 'WASM' && wasmCore !== null) {
                // @ts-ignore
                if (typeof wasmCore.compile_tenuto_to_ir_json === 'function') {
                    // @ts-ignore
                    wasmIrString = wasmCore.compile_tenuto_to_ir_json(processedCode);
                    wasmAst = JSON.parse(wasmIrString);
                    wasmSuccess = true;
                } else {
                    throw new Error("Wasm module not loaded or compile_tenuto_to_ir_json not found.");
                }
            } else {
                 throw new Error("Wasm engine is not active or not loaded yet.");
            }
        } catch (err: any) {
            // FFI String Safety: Ensure we have a valid string from the Wasm boundary
            const errString = typeof err === 'string' ? err : (err?.message || err?.toString() || 'Unknown Wasm Error');
            
            try {
                // The JSON Guard: Attempt to parse structured diagnostics
                const parsedDiagnostics = JSON.parse(errString);
                
                // Diagnostic Mapping: Normalize the Rust diagnostics to match TS format
                if (Array.isArray(parsedDiagnostics)) {
                    wasmDiagnostics = parsedDiagnostics.map(d => ({
                        status: 'fatal',
                        code: d.code || 'E1000',
                        type: 'Wasm Compiler Error',
                        location: {
                            line: d.line || 1,
                            column: d.column || 1
                        },
                        diagnostics: {
                            message: d.message || 'Unknown error'
                        },
                        source: 'rust'
                    }));
                } else {
                    throw new Error("Invalid diagnostic format");
                }
            } catch (parseErr) {
                // Legacy Fallback: Treat as raw string error
                wasmDiagnostics = [{
                    status: 'fatal',
                    code: 'E1000',
                    type: 'Wasm Compiler Error',
                    location: {
                        line: 1,
                        column: 1
                    },
                    diagnostics: {
                        message: errString
                    },
                    source: 'rust'
                }];
            }
        }

        if (activeEngine === 'WASM') {
            if (!wasmSuccess) {
                const response: CompilerResponse = { 
                    type: 'ERROR', 
                    payload: { 
                        message: "Wasm compilation failed",
                        diagnostics: wasmDiagnostics
                    } 
                };
                postMessage(response);
                return;
            }

            try {
                // Apply tempo override if provided
                if (tempoOverride && wasmAst && wasmAst.meta) {
                    wasmAst.meta.tempo = tempoOverride;
                }

                // 2. If valid, run the TS compiler to generate MIDI and SVG
                let midiBytes: Uint8Array;
                const midiGen = new MIDIGenerator();
                midiBytes = midiGen.generate(wasmAst);
                
                // Generate audio events directly from AST
                const audioGen = new AudioEventGenerator();
                const audioEvents = audioGen.generate(wasmAst);
                
                // Use our new TS-based engraver
                const engraver = new SVGEngraver();
                const { svgs: svgStrings, layout: scoreLayout } = engraver.render(wasmAst, wasmDiagnostics);
                
                const musicxmlExporter = new MusicXMLExporter();
                const musicxml = musicxmlExporter.export(wasmAst);
                
                const compileDuration = performance.now() - compileStartTime;
                
                const wasmResponse: StandardCompilerResponse = {
                    midi: midiBytes,
                    audioEvents: audioEvents,
                    svgs: svgStrings,
                    layout: scoreLayout,
                    musicxml: musicxml,
                    ast: wasmAst,
                    ir: wasmIrString,
                    rawCode: processedCode,
                    durationMs: compileDuration.toFixed(2),
                    diagnostics: wasmDiagnostics
                };

                const response: CompilerResponse = { 
                    type: 'SUCCESS', 
                    payload: wasmResponse 
                };
                postMessage(response);

                // Run TS parser in background for parity check (Silent Partner)
                setTimeout(() => {
                    try {
                        const parser = new Parser(processedCode);
                        let tsAst = parser.parse();
                        const unroller = new GraphUnroller(tsAst);
                        const unrolledAst = unroller.unroll();
                        const analyzer = new SemanticAnalyzer(unrolledAst);
                        const semanticErrors = analyzer.analyze();
                        
                        if (semanticErrors.length === 0 && wasmDiagnostics.length > 0) {
                            console.warn("[Parity Notice] Simulation Track (TS) is ahead of Steel Track (Wasm)");
                        }
                    } catch (e) {
                        // Silent failure for background TS track
                    }
                }, 0);
                
            } catch (err: any) {
                const response: CompilerResponse = { 
                    type: 'ERROR', 
                    payload: { 
                        message: err.toString(),
                        diagnostics: [{
                            status: 'fatal',
                            code: 'E0000',
                            type: 'Internal Compiler Error',
                            location: { line: 1, column: 1 },
                            diagnostics: { message: err.toString() }
                        }]
                    } 
                };
                postMessage(response);
            }
        } else {
            // Track A: TypeScript Authority (Preview Track)
            // This track is the source of truth for the AI Studio environment
            try {
                // 1. Run our TS Parser and Semantic Analyzer
                const parser = new Parser(processedCode);
                let ast = parser.parse();
                
                // Apply tempo override if provided
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
                
                // Parity Monitoring: Log if TS is ahead of Wasm
                if (semanticErrors.length === 0 && wasmDiagnostics.length > 0) {
                    console.warn("[Parity Notice] Simulation Track (TS) is ahead of Steel Track (Wasm)");
                }

                if (semanticErrors.length > 0) {
                    const diagnostics = semanticErrors.map(err => err.diagnostic);
                    
                    const response: CompilerResponse = { 
                        type: 'ERROR', 
                        payload: { 
                            message: "Semantic analysis failed",
                            diagnostics
                        } 
                    };
                    postMessage(response);
                    return;
                }

                const linter = new Linter();
                const lintDiagnostics = linter.lint(ast);

                // 2. If valid, run the TS compiler to generate MIDI and SVG
                let midiBytes: Uint8Array;
                const midiGen = new MIDIGenerator();
                midiBytes = midiGen.generate(unrolledAst);
                
                // Generate audio events directly from AST
                const audioGen = new AudioEventGenerator();
                const audioEvents = audioGen.generate(unrolledAst);
                
                // Use our new TS-based engraver
                const engraver = new SVGEngraver();
                const { svgs: svgStrings, layout: scoreLayout } = engraver.render(ast, lintDiagnostics);
                
                const musicxmlExporter = new MusicXMLExporter();
                const musicxml = musicxmlExporter.export(unrolledAst);
                
                const compileDuration = performance.now() - compileStartTime;
                
                const tsResponse: StandardCompilerResponse = {
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
                };

                const response: CompilerResponse = { 
                    type: 'SUCCESS', 
                    payload: tsResponse 
                };
                postMessage(response);

            } catch (err: any) {
                // TypeScript Track Error Handling
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
                
                const response: CompilerResponse = { 
                    type: 'ERROR', 
                    payload: { 
                        message: err.toString(),
                        diagnostics
                    } 
                };
                postMessage(response);
            }
        }

    } else if (type === 'DECOMPILE') {
        try {
            throw new Error("Decompilation is not supported in TS compiler or Wasm unavailable.");
        } catch (err: any) {
            const response: CompilerResponse = {
                type: 'ERROR',
                payload: { message: err.toString() }
            };
            postMessage(response);
        }
    }
};
