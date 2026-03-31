/**
 * @file decompile.ts
 * @description The Corpus Builder (Decompiler CLI) for Tenuto 3.0.
 * Implements Addendum D of the Language Specification: The Semantic Decompiler.
 * This script converts standard MIDI files into idiomatic Tenuto 3.0 code (.ten files)
 * utilizing the Rust Wasm compilation target (decompile_midi_to_tenuto).
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error("Usage: npm run decompile <input.mid> <output.ten>");
    process.exit(1);
  }

  const inputPath = resolve(args[0]);
  const outputPath = resolve(args[1]);

  try {
    console.log(`[TEDP Decompiler] Reading MIDI file: ${inputPath}`);
    const midiBuffer = await readFile(inputPath);
    const midiArray = new Uint8Array(midiBuffer);

    console.log(`[TEDP Decompiler] Loading Wasm decompiler...`);
    // @ts-ignore
    const wasmModule = await import(/* @vite-ignore */ '../public/pkg/tenutoc.js');
    await wasmModule.default();

    if (typeof wasmModule.decompile_midi_to_tenuto !== 'function') {
      throw new Error("decompile_midi_to_tenuto function not found in Wasm module.");
    }

    console.log(`[TEDP Decompiler] Decompiling MIDI to Tenuto 3.0...`);
    const tenutoCode = wasmModule.decompile_midi_to_tenuto(midiArray);

    await writeFile(outputPath, tenutoCode, 'utf-8');
    console.log(`[TEDP Decompiler] Successfully generated ${args[1]}`);
  } catch (error: any) {
    console.error(`[TEDP Decompiler] Error: ${error.message || error}`);
    process.exit(1);
  }
}

main();
