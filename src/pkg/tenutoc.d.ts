/* tslint:disable */
/* eslint-disable */

export function alloc_buffer(size: number): number;

export function compile_tenuto_json(source: string): string;

export function compile_tenuto_midi(source: string): Uint8Array;

export function compile_tenuto_musicxml(source: string): string;

export function compile_tenuto_to_svg(source: string): string;

export function decompile_midi_to_tenuto(midi_bytes: Uint8Array): string;

export function decompile_midi_zero_copy(ptr: number, len: number): string;

export function free_buffer(ptr: number, size: number): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly alloc_buffer: (a: number) => number;
    readonly compile_tenuto_json: (a: number, b: number) => [number, number, number, number];
    readonly compile_tenuto_midi: (a: number, b: number) => [number, number, number, number];
    readonly compile_tenuto_musicxml: (a: number, b: number) => [number, number, number, number];
    readonly compile_tenuto_to_svg: (a: number, b: number) => [number, number, number, number];
    readonly decompile_midi_to_tenuto: (a: number, b: number) => [number, number, number, number];
    readonly decompile_midi_zero_copy: (a: number, b: number) => [number, number, number, number];
    readonly free_buffer: (a: number, b: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
