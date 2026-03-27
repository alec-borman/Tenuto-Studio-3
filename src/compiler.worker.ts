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

let activeEngine: 'TYPESCRIPT' = 'TYPESCRIPT';
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
            console.log("[TEDP] Wasm Steel Track Connected.");
        } catch (e) {
            console.warn("[TEDP] Wasm Steel Track failed to connect. Falling back to TS Simulation.", e);
        }

        activeEngine = 'TYPESCRIPT';

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
        
        let tsResponse: StandardCompilerResponse | null = null;
        let wasmDiagnostics: any[] = [];
        let wasmSuccess = false;

        // Track B: Defensive Wasm (Production Track)
        // We assume the Wasm binary might be out of sync or return raw strings
        try {
            // @ts-ignore
            if (typeof self.compile_tenuto_to_midi === 'function') {
                // @ts-ignore
                const wasmResult = self.compile_tenuto_to_midi(processedCode);
                wasmSuccess = true;
            }
        } catch (err: any) {
            try {
                // The JSON Guard: Attempt to parse structured diagnostics
                wasmDiagnostics = JSON.parse(err.toString());
            } catch (parseErr) {
                // Legacy Fallback: Treat as raw string error
                wasmDiagnostics = [{
                    code: 'E1000',
                    message: err.toString(),
                    line: 1,
                    column: 1
                }];
            }
        }

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
