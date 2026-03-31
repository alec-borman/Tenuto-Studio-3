let isWasmLoaded = false;
let wasmMemory = null;
let compile_tenuto_to_midi, compile_tenuto_to_svg, decompile_midi_to_tenuto, alloc_buffer, free_buffer, decompile_midi_zero_copy;

async function bootCompiler() {
    try {
        const startTime = performance.now();
        const wasmModule = await import(/* @vite-ignore */ './pkg/tenutoc.js');
        const wasm = await wasmModule.default(); 
        
        compile_tenuto_to_midi = wasmModule.compile_tenuto_to_midi;
        compile_tenuto_to_svg = wasmModule.compile_tenuto_to_svg;
        decompile_midi_to_tenuto = wasmModule.decompile_midi_to_tenuto;
        alloc_buffer = wasmModule.alloc_buffer;
        free_buffer = wasmModule.free_buffer;
        decompile_midi_zero_copy = wasmModule.decompile_midi_zero_copy;

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
    } catch (e) {
        postMessage({ 
            type: 'STATUS', 
            status: 'ERROR', 
            error: e.toString() 
        });
    }
}

bootCompiler();

function parseDiagnostics(errorString, sourceCode) {
    const diagnostics = [];
    const lines = sourceCode.split('\n');
    const positionMatch = errorString.match(/position (\d+)/);
    
    if (positionMatch && positionMatch[1]) {
        const absolutePos = parseInt(positionMatch[1], 10);
        let currentPos = 0;
        let errorLine = 0;
        let errorCol = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + 1;
            if (currentPos + lineLength > absolutePos) {
                errorLine = i + 1;
                errorCol = (absolutePos - currentPos) + 1;
                break;
            }
            currentPos += lineLength;
        }

        diagnostics.push({
            line: errorLine,
            column: errorCol,
            message: errorString,
            severity: 'error'
        });
        
    } else {
        diagnostics.push({
            line: 1,
            column: 1,
            message: errorString,
            severity: 'error'
        });
    }
    
    return diagnostics;
}

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
            const midiBytes = compile_tenuto_to_midi(code);
            const svgString = compile_tenuto_to_svg(code);
            const compileDuration = performance.now() - compileStartTime;
            
            postMessage({ 
                type: 'SUCCESS', 
                payload: { 
                    midi: midiBytes,
                    svg: svgString,
                    durationMs: compileDuration.toFixed(2)
                } 
            });
            
        } catch (err) {
            const rawError = err.toString();
            const lspDiagnostics = parseDiagnostics(rawError, code);
            
            postMessage({ 
                type: 'ERROR', 
                payload: { 
                    message: rawError,
                    diagnostics: lspDiagnostics
                } 
            });
        }
    } else if (type === 'DECOMPILE') {
        try {
            let tenutoCode;
            const midiBytesArray = new Uint8Array(midi_bytes);
            
            // Zero-copy memory transfer implementation
            if (wasmMemory && typeof alloc_buffer === 'function' && typeof free_buffer === 'function' && typeof decompile_midi_zero_copy === 'function') {
                const len = midiBytesArray.length;
                const ptr = alloc_buffer(len);
                
                const memoryView = new Uint8Array(wasmMemory.buffer, ptr, len);
                memoryView.set(midiBytesArray);
                
                tenutoCode = decompile_midi_zero_copy(ptr, len);
                
                free_buffer(ptr, len);
            } else {
                // Fallback
                tenutoCode = decompile_midi_to_tenuto(midiBytesArray);
            }

            postMessage({
                type: 'DECOMPILE_SUCCESS',
                payload: {
                    code: tenutoCode
                }
            });
        } catch (err) {
            postMessage({
                type: 'ERROR',
                payload: {
                    message: err.toString()
                }
            });
        }
    }
};
