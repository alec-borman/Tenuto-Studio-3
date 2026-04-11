import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import init, { compile_tenuto_musicxml } from './src/pkg/tenutoc.js'; 

describe('MusicXML Export Engine Compliance', () => {
  it('exports valid MusicXML 4.0 handling polyphony with backup/forward tags', async () => {
    const wasmBuffer = readFileSync(resolve(__dirname, './src/pkg/tenutoc_bg.wasm'));
    await init(wasmBuffer);

    const tenutoSource = `
      tenuto "3.0" {
        measure 1 {
          pno: <[ v1: c4:4 d e f | v2: c3:1 ]>
        }
      }
    `;

    const rawXml = compile_tenuto_musicxml(tenutoSource);
    // Verify XML Declaration and Doctype
    expect(rawXml).toContain('<?xml version="1.0" encoding="UTF-8"');
    expect(rawXml).toContain('<score-partwise version="4.0">');

    // Verify Polyphonic Voice handling
    expect(rawXml).toContain('<backup>');
    expect(rawXml).toContain('<forward>');

    // Verify basic note data
    expect(rawXml).toContain('<step>C</step>');
    expect(rawXml).toContain('<octave>4</octave>');
    expect(rawXml).toContain('<step>C</step>');
    expect(rawXml).toContain('<octave>3</octave>');
  });
});
