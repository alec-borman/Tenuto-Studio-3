import { MusicXMLExporter } from './compiler/musicxml';
import { MIDIGenerator } from './compiler/midi';
import { AudioEventGenerator } from './compiler/audio';

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
            await wasmModule.default(); 
            wasmCore = wasmModule;
            console.log("[TEDP] Wasm Steel Track Connected. Absolute Authority Established.");
        } catch (e) {
            console.error("[TEDP] FATAL: Wasm Steel Track failed to connect. The Skyscraper cannot stand without steel.", e);
            throw e;
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
            if (wasmCore !== null) {
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
            // const engraver = new SVGEngraver();
            // const { svgs: svgStrings, layout: scoreLayout } = engraver.render(wasmAst, wasmDiagnostics);
            
            let svgStrings: string[] = [];
            try {
                const wasmSvgJson = wasmCore.compile_tenuto_to_svg(processedCode);
                svgStrings = JSON.parse(wasmSvgJson);
            } catch (e) {
                console.error("Wasm SVG generation failed:", e);
            }
            const scoreLayout: any = { pages: [], width: 800, height: 2970 };
            
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
