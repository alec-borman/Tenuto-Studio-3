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

let wasmModule: any = null;
let activeEngine: 'RUST' | 'TYPESCRIPT' = 'TYPESCRIPT';
const DEBUG_PARITY = true;

async function bootCompiler() {
    try {
        const startTime = performance.now();
        
        try {
            // @ts-ignore
            wasmModule = await import(/* @vite-ignore */ '../public/pkg/tenutoc.js');
            await wasmModule.default();
            activeEngine = 'RUST';
            console.log("[Shadow] Wasm initialized successfully.");
        } catch (e) {
            console.warn("[Shadow] Wasm unavailable, falling back to TS scaffolding.", e);
            activeEngine = 'TYPESCRIPT';
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
        
        let rustResponse: StandardCompilerResponse | null = null;
        let tsResponse: StandardCompilerResponse | null = null;
        let tsError: any = null;

        // The "Steel" Path
        if (activeEngine === 'RUST') {
            try {
                if (typeof wasmModule.compile_tenuto_to_midi === 'function') {
                    const result = wasmModule.compile_tenuto_to_midi(processedCode, tempoOverride || 120);
                    rustResponse = JSON.parse(result) as StandardCompilerResponse;
                } else {
                    throw new Error("compile_tenuto_to_midi not found in Wasm module");
                }
            } catch (err) {
                console.warn("[Shadow] Wasm unavailable or threw an error, falling back to TS scaffolding.", err);
                activeEngine = 'TYPESCRIPT';
            }
        }

        // The "Scaffolding" Fallback (and Parity Check)
        if (activeEngine === 'TYPESCRIPT' || DEBUG_PARITY) {
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
                
                tsResponse = {
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
            } catch (err: any) {
                tsError = err;
            }
        }

        // Parity Check (The Anti-Drift Guard)
        if (DEBUG_PARITY && rustResponse && tsResponse) {
            if (rustResponse.audioEvents?.length !== tsResponse.audioEvents?.length) {
                console.warn(`[PARITY ALERT] Rust and TS engines have diverged! Rust events: ${rustResponse.audioEvents?.length}, TS events: ${tsResponse.audioEvents?.length}`);
            }
        }

        // Dispatch Response
        if (activeEngine === 'TYPESCRIPT' && tsError) {
            let diagnostics = [];
            if (tsError instanceof CompilerError) {
                diagnostics.push(tsError.diagnostic);
            } else {
                diagnostics.push({
                    status: 'fatal',
                    code: 'E0000',
                    type: 'Internal Compiler Error',
                    location: { line: 1, column: 1 },
                    diagnostics: {
                        message: tsError.toString()
                    }
                });
            }
            
            const response: CompilerResponse = { 
                type: 'ERROR', 
                payload: { 
                    message: tsError.toString(),
                    diagnostics
                } 
            };
            postMessage(response);
            return;
        }

        const finalResponse = activeEngine === 'RUST' ? rustResponse : tsResponse;
        
        if (finalResponse) {
            const response: CompilerResponse = { 
                type: 'SUCCESS', 
                payload: finalResponse 
            };
            postMessage(response);
        }

    } else if (type === 'DECOMPILE') {
        try {
            if (activeEngine === 'RUST' && typeof wasmModule.decompile_midi_to_tenuto === 'function') {
                const result = wasmModule.decompile_midi_to_tenuto(midi_bytes);
                const response: CompilerResponse = {
                    type: 'DECOMPILE_SUCCESS',
                    payload: { code: result }
                };
                postMessage(response);
            } else {
                throw new Error("Decompilation is not supported in TS compiler or Wasm unavailable.");
            }
        } catch (err: any) {
            const response: CompilerResponse = {
                type: 'ERROR',
                payload: { message: err.toString() }
            };
            postMessage(response);
        }
    }
};
