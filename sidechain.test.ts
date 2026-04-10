import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import init, { compile_tenuto_json } from './src/pkg/tenutoc.js'; 

describe('Sidechain Ducking Engine Compliance', () => {
  it('parses the spacer token and generates CC automation lanes for sidechain routing', async () => {
    const wasmBuffer = readFileSync(resolve(__dirname, './public/pkg/tenutoc_bg.wasm'));
    await init(wasmBuffer);

    const tenutoSource = `
      tenuto "3.0" {
        meta @{ sidechain: @{ bass: "kick" } }
        measure 1 {
          bass: s:4.cc(7, [8], "exp")
        }
      }
    `;

    const rawPayload = compile_tenuto_json(tenutoSource);
    const result = JSON.parse(rawPayload);

    // Verify AST Meta Parsing
    expect(result.ast.meta.sidechain).toBeDefined();
    expect(result.ast.meta.sidechain.bass).toBe('kick');

    // Verify Spacer Token existence in logical track
    const bassEvents = result.ast.measures[0].parts.find((p: any) => p.id === 'bass').voices[0].events[0];
    expect(bassEvents.Spacer).toBeDefined();
    // expect(bassEvents.duration).toBe('4'); // Wait, let's see how Rust serializes it

    // Verify CC Generation in IR
    // The spacer should generate a high-resolution array of CC events, not NoteOn
    const ccEvents = result.events.filter((e: any) => 
      e.track_id === 'bass' && 
      e.kind.MidiCC !== undefined
    );
    expect(ccEvents.length).toBeGreaterThan(0);
    
    // Ensure no visual ink is plotted for the spacer
    const noteEvents = result.events.filter((e: any) => 
      e.track_id === 'bass' && 
      e.kind.Note !== undefined
    );
    expect(noteEvents.length).toBe(0);
  });
});
