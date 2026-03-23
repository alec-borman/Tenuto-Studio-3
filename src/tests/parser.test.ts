import { describe, it, expect } from 'vitest';
import { Parser } from '../compiler/parser';

describe('Parser: Token Geometry & Dot Absorption', () => {
  it('should absorb the dot if it physically touches the duration token', () => {
    const code = `tenuto "3.0" {
      measure 1 {
        synth1: c4:1.slice(2)
      }
    }`;
    const parser = new Parser(code);
    const ast = parser.parse();
    
    const measure = ast.measures[0];
    const event = measure.parts[0].voices[0].events[0];
    if (event.type !== 'note') throw new Error('Expected Note');
    
    expect(event.duration).toBe('1');
    expect(event.modifiers).toContain('slice(2)');
  });

  it('should NOT absorb the dot if there is a space between duration and dot', () => {
    const code = `tenuto "3.0" {
      measure 1 {
        synth1: c4:1 .slice(2)
      }
    }`;
    const parser = new Parser(code);
    const ast = parser.parse();
    
    const measure = ast.measures[0];
    const event = measure.parts[0].voices[0].events[0];
    if (event.type !== 'note') throw new Error('Expected Note');
    
    // The duration should be parsed as '1' and the dot is treated separately
    expect(event.duration).toBe('1');
    // The modifier should still be applied because the while loop picks it up
    expect(event.modifiers).toContain('slice(2)');
  });

  it('should parse dotted durations correctly when not followed by a modifier', () => {
    const code = `tenuto "3.0" {
      measure 1 {
        synth1: c4:4.
      }
    }`;
    const parser = new Parser(code);
    const ast = parser.parse();
    
    const measure = ast.measures[0];
    const event = measure.parts[0].voices[0].events[0];
    if (event.type !== 'note') throw new Error('Expected Note');
    
    expect(event.duration).toBe('4.');
  });
  
  it('should handle chained articulations correctly', () => {
    const code = `tenuto "3.0" {
      measure 1 {
        synth1: c4:4.stacc.marc
      }
    }`;
    const parser = new Parser(code);
    const ast = parser.parse();
    
    const measure = ast.measures[0];
    const event = measure.parts[0].voices[0].events[0];
    if (event.type !== 'note') throw new Error('Expected Note');
    
    expect(event.duration).toBe('4');
    expect(event.modifiers).toContain('stacc');
    expect(event.modifiers).toContain('marc');
    expect(event.articulation).toBe('marc'); // The last articulation is stored
  });
});
