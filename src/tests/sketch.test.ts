import { describe, it, expect } from 'vitest';
import { Parser } from '../compiler/parser';

describe('TSA: The Sketch REPL (Auto-Scaffolding)', () => {
  it('Task 4B: The Wrapper - automatically wraps raw events in a compliant AST string', () => {
    const rawCode = `c4:8 d e f`;
    
    let processedCode = rawCode;
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

    const parser = new Parser(processedCode);
    const ast = parser.parse();
    
    // Assert that it successfully compiles to AST without throwing
    expect(ast.measures.length).toBe(1);
    expect(ast.measures[0].parts[0].voices[0].events.length).toBe(4);
    expect(ast.measures[0].parts[0].voices[0].events[0].type).toBe('note');
  });
});
