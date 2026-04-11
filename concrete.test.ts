import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import init, { compile_tenuto_json } from './src/pkg/tenutoc.js'; 

describe('Concrete Audio Engine Compliance', () => {
  it('parses style=concrete and evaluates granular slicing and stretch modifiers into the IR timeline', async () => {
    const wasmBuffer = readFileSync(resolve(__dirname, './src/pkg/tenutoc_bg.wasm'));
    await init(wasmBuffer);

    const tenutoSource = `
      tenuto "3.0" {
        def vox "Vocal Chop" style=concrete src="bus://vox" map=@{ A: [0ms, 1500ms] }
        measure 1 {
          vox: A:2.slice(8) A:4.stretch A:4.reverse
        }
      }
    `;

    const rawPayload = compile_tenuto_json(tenutoSource);
    const result = JSON.parse(rawPayload);

    // Verify AST Parsing
    const voxDef = result.ast.defs.find(d => d.id === 'vox');
    expect(voxDef.style).toBe('concrete');
    expect(voxDef.src).toBe('bus://vox');
    expect(voxDef.map).toHaveProperty('A');

    // Verify IR Expansion for .slice(8)
    const sliceEvents = result.events.filter(e => 
      e.track_id === 'vox' && 
      e.kind.Concrete?.params?.chop_size === 8
    );
    console.log(JSON.stringify(result.ast.measures[0].parts[0].voices[0].events, null, 2)); expect(sliceEvents.length).toBe(8); // Half note sliced into 8 discrete chunks

    // Verify .stretch modifier
    const stretchEvent = result.events.find(e => 
      e.track_id === 'vox' && 
      e.logical_duration.num === 1 && 
      e.logical_duration.den === 4 &&
      e.kind.Concrete?.params?.stretch_factor !== undefined
    );
    expect(stretchEvent).toBeDefined();

    // Verify .reverse modifier
    const reverseEvent = result.events.find(e => 
      e.track_id === 'vox' && 
      e.kind.Concrete?.params?.reverse === true
    );
    expect(reverseEvent).toBeDefined();
  });
});
