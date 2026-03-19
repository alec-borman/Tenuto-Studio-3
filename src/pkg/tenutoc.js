let wasm;

export default async function init() {
    // Simulate WASM initialization
    // In a real wasm-bindgen output, this would fetch and instantiate the .wasm file
    wasm = {
        memory: new WebAssembly.Memory({ initial: 256, maximum: 256 }),
        alloc_buffer: (size) => {
            // Simulate allocation by returning a pointer (offset in memory)
            // For this mock, we'll just use offset 0
            return 0;
        },
        free_buffer: (ptr, size) => {
            // Simulate freeing memory
        },
        decompile_midi_zero_copy: (ptr, len) => {
            // Simulate reading from WASM memory and decompiling
            const memoryView = new Uint8Array(wasm.memory.buffer, ptr, len);
            return decompile_midi_to_tenuto(memoryView);
        }
    };
    return wasm;
}

export function alloc_buffer(size) {
    if (!wasm) throw new Error("WASM not initialized");
    return wasm.alloc_buffer(size);
}

export function free_buffer(ptr, size) {
    if (!wasm) throw new Error("WASM not initialized");
    return wasm.free_buffer(ptr, size);
}

export function decompile_midi_zero_copy(ptr, len) {
    if (!wasm) throw new Error("WASM not initialized");
    return wasm.decompile_midi_zero_copy(ptr, len);
}

export function compile_tenuto_to_midi(source) {
    // Mock implementation
    return new Uint8Array([0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, 0x00, 0x01, 0x00, 0x60, 0x4D, 0x54, 0x72, 0x6B, 0x00, 0x00, 0x00, 0x04, 0x00, 0xFF, 0x2F, 0x00]);
}

export function compile_tenuto_to_svg(source) {
    // Mock implementation
    return `<svg viewBox="0 0 2100 2970" xmlns="http://www.w3.org/2000/svg">
        <text x="1050" y="100" text-anchor="middle" font-size="24">Tenuto Score</text>
        <g class="system" transform="translate(100, 200)">
            <path class="staff-lines" d="M 0 0 L 1900 0" stroke="black" />
            <path class="staff-lines" d="M 0 10 L 1900 10" stroke="black" />
            <path class="staff-lines" d="M 0 20 L 1900 20" stroke="black" />
            <path class="staff-lines" d="M 0 30 L 1900 30" stroke="black" />
            <path class="staff-lines" d="M 0 40 L 1900 40" stroke="black" />
            <ellipse cx="100" cy="20" rx="6" ry="4" fill="black" transform="rotate(-20 100 20)" />
            <line x1="105" y1="20" x2="105" y2="-10" stroke="black" stroke-width="1.2" />
        </g>
    </svg>`;
}

export function decompile_midi_to_tenuto(midi_bytes) {
    // Mock implementation
    return `tenuto "3.0" {
  meta @{ title: "Decompiled Score", tempo: 120, time: "4/4" }
  def trk_0 "Track 0" style=standard
  measure 1 {
    trk_0: c4:4 d e f |
  }
}`;
}
